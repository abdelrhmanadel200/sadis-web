// POST /api/auth/password-login
//
// الدخول بكلمة المرور (الويب وتطبيق الموبايل)، بالبريد أو برقم الهاتف.
//
// Body: { email?: string, phone?: string, password: string }  (معرف واحد فقط)
//
// الردود:
//   200 { user_id, access_token, refresh_token, expires_in }
//   400 { message }
//   401 { code: 'invalid_credentials', message }
//   429 { code: 'locked', retry_after, message }
//   5xx { message }
//
// الخطوات: حجز محاولة للمعرف (5 كل 15 دقيقة) وللـ IP (30 كل 15 دقيقة)، ثم
// البحث عن الحساب في قاعدة البيانات، ثم دخول GoTrue بالبريد الحقيقي للحساب من
// السيرفر (GoTrue لا يقبل الهاتف مع كلمة المرور). بريد الحساب لا يرسل للعميل.
// الحساب الذي لم يعين طالبه كلمة مرور من حسابي يرفض حتى لو كان في GoTrue
// كلمة مرور قديمة من النظام.

import { NextRequest } from 'next/server';
import { normalizePhone } from '@/lib/phone-otp';
import { normalizePasswordInput, PASSWORD_MAX_BYTES } from '@/lib/password-rules';
import {
  adminClient,
  attemptKey,
  attemptSuccess,
  claimAttempt,
  clientIp,
  findLoginUser,
  gotrueMessage,
  isGotrueBusy,
  json,
  minutesText,
  padResponseTime,
  passwordGrant,
  SYNTHETIC_EMAIL_SUFFIX,
} from '@/lib/auth-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IDENT_MAX = 5;
const IP_MAX = 30;
const WINDOW_SECONDS = 15 * 60;
const LOCK_SECONDS = 15 * 60;

const INVALID_MESSAGE = 'بيانات الدخول غير صحيحة. إذا لم تعين كلمة مرور بعد فادخل برمز التحقق.';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function invalid() {
  return json(401, { code: 'invalid_credentials', message: INVALID_MESSAGE });
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  let body: { email?: unknown; phone?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { message: 'بيانات غير صالحة.' });
  }

  const rawEmail = typeof body.email === 'string' ? body.email.trim() : '';
  const rawPhone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const rawPassword = typeof body.password === 'string' ? body.password : '';

  if ((rawEmail ? 1 : 0) + (rawPhone ? 1 : 0) !== 1) {
    return json(400, { message: 'ادخل البريد الإلكتروني أو رقم الهاتف.' });
  }
  if (!rawPassword) return json(400, { message: 'ادخل كلمة المرور.' });

  let kind: 'phone' | 'email';
  let ident: string;
  if (rawPhone) {
    const digits = normalizePhone(rawPhone);
    if (!/^[0-9]{10,15}$/.test(digits) || digits.startsWith('0')) {
      return json(400, { message: 'رقم الهاتف غير صالح.' });
    }
    kind = 'phone';
    ident = digits;
  } else {
    const email = rawEmail.toLowerCase();
    if (email.length > 254 || !EMAIL_RE.test(email)) {
      return json(400, { message: 'صيغة البريد الإلكتروني غير صحيحة.' });
    }
    if (email.endsWith(SYNTHETIC_EMAIL_SUFFIX)) {
      return json(400, { message: 'ادخل برقم هاتفك.' });
    }
    kind = 'email';
    ident = email;
  }

  const supa = adminClient();
  const identKey = attemptKey(`pwlogin:${kind}`, ident);
  const ipKey = attemptKey('pwlogin:ip', clientIp(req));

  // حجز المحاولة قبل أي فحص لكلمة المرور. عند عطل القاعدة نرفض (لا دخول بلا عداد).
  const [identClaim, ipClaim] = await Promise.all([
    claimAttempt(supa, identKey, IDENT_MAX, WINDOW_SECONDS, LOCK_SECONDS),
    claimAttempt(supa, ipKey, IP_MAX, WINDOW_SECONDS, LOCK_SECONDS),
  ]);
  if (!identClaim.ok || !ipClaim.ok) {
    console.error('password-login: attempt claim failed', !identClaim.ok ? identClaim.error : null, !ipClaim.ok ? ipClaim.error : null);
    return json(503, { message: 'الدخول بكلمة المرور غير متاح الآن، ادخل برمز التحقق.' });
  }
  if (!identClaim.allowed || !ipClaim.allowed) {
    const retryAfter = Math.max(
      identClaim.allowed ? 0 : identClaim.retryAfter,
      ipClaim.allowed ? 0 : ipClaim.retryAfter,
      1,
    );
    return json(
      429,
      {
        code: 'locked',
        retry_after: retryAfter,
        message: `محاولات كثيرة. حاول بعد ${minutesText(retryAfter)} أو ادخل برمز التحقق.`,
      },
      { 'Retry-After': String(retryAfter) },
    );
  }

  const found = await findLoginUser(supa, kind === 'phone' ? { phone: ident } : { email: ident });
  if (!found.ok) {
    console.error('password-login: auth_find_login_user failed', found.error);
    return json(500, { message: 'تعذر تسجيل الدخول الآن، حاول بعد قليل.' });
  }
  const account = found.user;
  if (!account || !account.has_password || !account.email) {
    await padResponseTime(startedAt);
    return invalid();
  }

  const password = normalizePasswordInput(rawPassword);
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    await padResponseTime(startedAt);
    return invalid();
  }

  const grant = await passwordGrant(account.email, password);
  if (!grant.ok) {
    if (isGotrueBusy(grant)) {
      console.error('password-login: grant unavailable', grant.status, grant.code);
      return json(503, { message: gotrueMessage(grant.code, 'الخادم مشغول، حاول بعد قليل.') });
    }
    // باقي الأخطاء (ومنها الحساب الموقوف) بنفس الرد، حتى لا يكشف شيئا عن الحساب.
    await padResponseTime(startedAt);
    return invalid();
  }

  await attemptSuccess(supa, identKey, ipKey);

  return json(200, {
    user_id: grant.userId ?? account.id,
    access_token: grant.session.access_token,
    refresh_token: grant.session.refresh_token,
    expires_in: grant.session.expires_in,
  });
}
