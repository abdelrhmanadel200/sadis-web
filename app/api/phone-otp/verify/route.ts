// POST /api/phone-otp/verify
//
// Body: { phone: string, code: string, exchange?: 'client' }  // 4-digit numeric code
//
// On success returns:
//   exchange === 'client':  { user_id, token_hash }
//     العميل يستبدله بجلسة: verifyOtp({ token_hash, type: 'magiclink' }) في الويب،
//     و auth.verifyOTP(tokenHash:, type: OtpType.magiclink) في تطبيق Flutter.
//   بدون exchange (نسخ التطبيق القديمة):
//     { user_id, access_token, refresh_token, expires_in }
//
// Flow:
//   1. Validate the OTP (hash compare, not expired, not consumed, attempts<5).
//   2. Find the account by phone (or its synthetic email) with auth_find_login_user.
//   3. Burn the OTP row (only one request can use a correct code).
//   4. Create the synthetic account `${phone}@phone.sadisultra.local` if missing,
//      WITHOUT a password (we use OTPIQ, not Supabase phone auth).
//   5. Mint a session through a magic link for the account email (synthetic or
//      the real email of a linked account). SMS login never touches passwords:
//      a password set from حسابي stays valid and other devices stay logged in.

import { NextRequest } from 'next/server';
import { adminClient, hashCode, normalizePhone, syntheticEmail } from '@/lib/phone-otp';
import { findLoginUser, mintMagicLinkHash, mintSession, type LoginUser } from '@/lib/auth-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function bad(message: string, status = 400, extras: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({ message, ...extras }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
}

function ok(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function POST(req: NextRequest) {
  let body: { phone?: string; code?: string; exchange?: string };
  try {
    body = await req.json();
  } catch {
    return bad('JSON body مطلوب');
  }

  const phone = normalizePhone(String(body.phone ?? '').trim());
  const code = String(body.code ?? '').trim();
  const clientExchange = body.exchange === 'client';
  if (!/^[0-9]{10,15}$/.test(phone) || phone.startsWith('0') || !/^[0-9]{4}$/.test(code)) {
    return bad('بيانات غير صالحة');
  }

  const supa = adminClient();

  // 1. احجز محاولة بشكل ذري ثم قارن الرمز: otp_claim_attempt يقفل الصف
  //    ويعيد فحص attempts < 5، فالطلبات المتوازية لا تتجاوز 5 محاولات.
  const { data: claimed, error: claimErr } = await supa.rpc('otp_claim_attempt', { p_phone: phone });
  if (claimErr) return bad('خطأ في قاعدة البيانات', 500);
  const row = (claimed as { id: string; code_hash: string }[] | null)?.[0];
  if (!row) return bad('انتهت صلاحية الرمز أو تجاوزت عدد المحاولات، اطلب رمز جديد', 429);
  if (row.code_hash !== hashCode(code)) return bad('الرمز غير صحيح', 401);

  // 2. ابحث عن الحساب قبل حرق الرمز، حتى لا يضيع رمز صحيح بسبب خطأ في البحث.
  //    رقم مربوط بحساب حقيقي (بريد/جوجل) يطابق أولا، ثم البريد الاصطناعي.
  const email = syntheticEmail(phone);
  const found = await findLoginUser(supa, { phone, email });
  if (!found.ok) {
    console.error('phone-otp/verify: auth_find_login_user failed', found.error);
    return bad('خطأ في البحث عن المستخدم', 500);
  }

  // 3. احرق الرمز بشرط أنه لم يستخدم: طلب واحد فقط يمر بالرمز الصحيح.
  const { data: burned, error: burnErr } = await supa
    .from('phone_otp_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', row.id)
    .is('consumed_at', null)
    .select('id');
  if (burnErr) return bad('خطأ في قاعدة البيانات', 500);
  if (!burned || burned.length === 0) return bad('الرمز مستخدم، اطلب رمز جديد', 409);

  // عند فشل من جهة الخادم بعد الحرق نرجع الرمز صالحا، فيستطيع الطالب إعادة المحاولة.
  const unburn = async () => {
    const { error } = await supa.from('phone_otp_codes').update({ consumed_at: null }).eq('id', row.id);
    if (error) console.error('phone-otp/verify: unburn failed', error);
  };

  // 4. حساب جديد بلا كلمة مرور، أو الحساب الموجود.
  let account: LoginUser | null = found.user;
  if (!account) {
    const created = await supa.auth.admin.createUser({
      email,
      email_confirm: true,
      phone,
      phone_confirm: true,
      user_metadata: { phone, signup_method: 'phone_otp' },
    });
    if (created.data?.user && !created.error) {
      account = { id: created.data.user.id, email: created.data.user.email ?? email, has_password: false };
    } else {
      const errCode = created.error?.code;
      // طلب آخر أنشأ الحساب بنفس اللحظة، أو الرقم مربوط بحساب آخر: ابحث مرة ثانية.
      if (errCode === 'email_exists' || errCode === 'phone_exists' || created.error?.status === 422) {
        const again = await findLoginUser(supa, { phone, email });
        if (again.ok && again.user) account = again.user;
      }
      if (!account) {
        console.error('phone-otp/verify: createUser failed', created.error);
        await unburn();
        return bad('فشل إنشاء الحساب', 500);
      }
    }
  } else {
    // كلمة المرور المخفية القديمة لحسابات الهاتف تمسح (لا تمس كلمة عينها الطالب
    // أو حساب مدير، ولا تلغي الجلسات). الخطأ هنا لا يمنع الدخول.
    const { error: clearErr } = await supa.rpc('clear_synthetic_password', { p_user: account.id });
    if (clearErr) console.error('phone-otp/verify: clear_synthetic_password failed', clearErr.message);
  }

  const accountEmail = account.email;
  if (!accountEmail) {
    console.error('phone-otp/verify: account has no email', account.id);
    await unburn();
    return bad('فشل إنشاء الجلسة', 500);
  }

  // 5. الجلسة عبر رابط سحري.
  if (clientExchange) {
    const tokenHash = await mintMagicLinkHash(accountEmail, supa);
    if (!tokenHash) {
      await unburn();
      return bad('فشل إنشاء الجلسة', 500);
    }
    return ok({ user_id: account.id, token_hash: tokenHash });
  }

  const session = await mintSession(accountEmail, supa);
  if (!session) {
    await unburn();
    return bad('فشل إنشاء الجلسة', 500);
  }
  return ok({
    user_id: account.id,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
  });
}
