// POST /api/account/password
//
// تعيين أو تغيير كلمة المرور من صفحة حسابي (الويب وتطبيق الموبايل).
//
// Auth: Authorization: Bearer <access_token>
// Body: { new_password: string, current_password?: string }
//
// الردود:
//   200 { ok: true }                         الجلسة الحالية تبقى، باقي الأجهزة تخرج
//   200 { ok: true, session: {access_token, refresh_token, expires_in} }
//                                            نادرا: كل الجلسات ألغيت، والعميل يضع هذه الجلسة
//   400 { code: 'weak_password', message }
//   401 { code: 'current_password_invalid' | 'unauthorized', message }
//   422 { code: 'same_password', message }
//   429 { code: 'locked', retry_after, message }
//
// كلمة المرور الحالية مطلوبة فقط إذا عين الطالب كلمة مرور من قبل
// (app_metadata.password_set_at)، إلا إذا كانت الجلسة من دخول برمز التحقق قبل
// 10 دقائق أو أقل (amr في التوكن): هذا طريق "نسيت كلمة المرور". العلامة يكتبها
// السيرفر فقط، وبدون حقل password حتى لا تلغى الجلسات.

import { NextRequest } from 'next/server';
import { normalizePasswordInput, passwordRuleError } from '@/lib/password-rules';
import {
  adminClient,
  attemptKey,
  attemptSuccess,
  bearerUser,
  claimAttempt,
  gotrueMessage,
  isGotrueBusy,
  json,
  minutesText,
  passwordGrant,
  recentOtpLogin,
  revokeSession,
  updateOwnPassword,
  type TokenSession,
} from '@/lib/auth-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CHANGE_MAX = 5;
const WINDOW_SECONDS = 15 * 60;
const LOCK_SECONDS = 15 * 60;

// GoTrue يطلب إعادة تحقق (تغيير آمن لكلمة المرور مفعل، أو جلسة قديمة).
const REAUTH_CODES = new Set(['reauthentication_needed', 'reauth_nonce_missing', 'current_password_required']);
const SESSION_CODES = new Set(['bad_jwt', 'session_not_found', 'session_expired', 'no_authorization']);

const BUSY_MESSAGE = 'الخادم مشغول، حاول بعد قليل.';
const SAVE_FAILED_MESSAGE = 'تعذر حفظ كلمة المرور، حاول مرة ثانية.';

export async function POST(req: NextRequest) {
  const auth = await bearerUser(req);
  if (!auth) return json(401, { code: 'unauthorized', message: 'سجل دخول أولا.' });
  const { user, token } = auth;

  let body: { new_password?: unknown; current_password?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { message: 'بيانات غير صالحة.' });
  }

  const newPassword = normalizePasswordInput(typeof body.new_password === 'string' ? body.new_password : '');
  const ruleError = passwordRuleError(newPassword);
  if (ruleError) return json(400, { code: 'weak_password', message: ruleError });

  const supa = adminClient();
  const key = attemptKey('pwchange', user.id);
  const claim = await claimAttempt(supa, key, CHANGE_MAX, WINDOW_SECONDS, LOCK_SECONDS);
  if (!claim.ok) {
    console.error('account/password: attempt claim failed', claim.error);
    return json(503, { message: 'تعذر حفظ كلمة المرور الآن، حاول بعد قليل.' });
  }
  if (!claim.allowed) {
    const retryAfter = Math.max(1, claim.retryAfter);
    return json(
      429,
      {
        code: 'locked',
        retry_after: retryAfter,
        message: `محاولات كثيرة. حاول بعد ${minutesText(retryAfter)}.`,
      },
      { 'Retry-After': String(retryAfter) },
    );
  }

  const appMeta = (user.app_metadata ?? {}) as Record<string, unknown>;
  const hasMarker = !!appMeta.password_set_at;
  const email = user.email ?? '';

  // ١) كلمة المرور الحالية، فقط لمن عين كلمة مرور من قبل ولم يدخل برمز التحقق الآن.
  if (hasMarker && !recentOtpLogin(token)) {
    const current = normalizePasswordInput(
      typeof body.current_password === 'string' ? body.current_password : '',
    );
    if (!current) {
      return json(401, { code: 'current_password_invalid', message: 'ادخل كلمة المرور الحالية.' });
    }
    if (!email) {
      console.error('account/password: user has marker but no email', user.id);
      return json(500, { message: SAVE_FAILED_MESSAGE });
    }
    const check = await passwordGrant(email, current);
    if (!check.ok) {
      if (isGotrueBusy(check)) {
        console.error('account/password: current password check unavailable', check.status, check.code);
        return json(503, { message: gotrueMessage(check.code, BUSY_MESSAGE) });
      }
      return json(401, { code: 'current_password_invalid', message: 'كلمة المرور الحالية غير صحيحة.' });
    }
    // جلسة التحقق لا نحتاجها.
    await revokeSession(check.session.access_token);
    if (check.userId && check.userId !== user.id) {
      return json(401, { code: 'current_password_invalid', message: 'كلمة المرور الحالية غير صحيحة.' });
    }
  }

  const marker = { ...appMeta, password_set_at: new Date().toISOString() };
  let session: TokenSession | null = null;
  let relogin = false;
  let markerSaved = false;

  // ٢) التغيير بتوكن الطالب نفسه: جلسته الحالية تبقى.
  const upd = await updateOwnPassword(token, newPassword);
  if (!upd.ok) {
    if (upd.code === 'same_password') {
      if (hasMarker) {
        return json(422, { code: 'same_password', message: gotrueMessage('same_password') });
      }
      // بلا علامة: هذه أصلا كلمة مرور الحساب (مدير، أو محاولة سابقة لم تحفظ
      // علامتها). نكمل ونحفظ العلامة فقط.
    } else if (upd.code === 'weak_password') {
      return json(400, { code: 'weak_password', message: gotrueMessage('weak_password') });
    } else if (REAUTH_CODES.has(upd.code)) {
      // بديل نادر: تغيير من الإدارة مع العلامة في طلب واحد. هذا يلغي كل الجلسات،
      // فنصدر جلسة جديدة بالكلمة الجديدة ونرجعها للعميل.
      if (!email) {
        console.error('account/password: reauth fallback without email', user.id);
        return json(500, { message: SAVE_FAILED_MESSAGE });
      }
      const adminUpd = await supa.auth.admin.updateUserById(user.id, {
        password: newPassword,
        app_metadata: marker,
      });
      if (adminUpd.error) {
        console.error('account/password: admin password update failed', adminUpd.error);
        if (adminUpd.error.code === 'weak_password') {
          return json(400, { code: 'weak_password', message: gotrueMessage('weak_password') });
        }
        return json(500, { message: gotrueMessage(adminUpd.error.code, SAVE_FAILED_MESSAGE) });
      }
      markerSaved = true;
      const grant = await passwordGrant(email, newPassword);
      if (grant.ok) {
        session = grant.session;
      } else {
        console.error('account/password: grant after admin update failed', grant.status, grant.code);
        relogin = true;
      }
    } else if (upd.status === 401 || SESSION_CODES.has(upd.code)) {
      return json(401, { code: 'unauthorized', message: 'انتهت الجلسة، سجل دخول مرة ثانية.' });
    } else if (isGotrueBusy(upd)) {
      console.error('account/password: update unavailable', upd.status, upd.code);
      return json(503, { message: gotrueMessage(upd.code, BUSY_MESSAGE) });
    } else {
      console.error('account/password: update failed', upd.status, upd.code, upd.message);
      return json(500, { message: gotrueMessage(upd.code, SAVE_FAILED_MESSAGE) });
    }
  }

  // ٣) العلامة التي تفعل الدخول بكلمة المرور (بدون password حتى لا تلغى الجلسات).
  if (!markerSaved) {
    let metaError: unknown = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const { error } = await supa.auth.admin.updateUserById(user.id, { app_metadata: marker });
      metaError = error;
      if (!error) break;
    }
    if (metaError) {
      console.error('account/password: marker update failed', metaError);
      return json(500, {
        message: 'تم تغيير كلمة المرور لكن تعذر تفعيل الدخول بها. أعد المحاولة بنفس الكلمة.',
      });
    }
  }

  await attemptSuccess(supa, key, key);

  if (session) return json(200, { ok: true, session });
  if (relogin) return json(200, { ok: true, relogin: true });
  return json(200, { ok: true });
}
