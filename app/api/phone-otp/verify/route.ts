// POST /api/phone-otp/verify
//
// Body: { phone: string, code: string }  // 4-digit numeric code
//
// On success returns:
//   { user_id, access_token, refresh_token, expires_in }
//
// The Flutter app hands these tokens to `supabase.auth.setSession(refresh_token)`
// and the user is signed in.
//
// Flow:
//   1. Validate the OTP (hash compare, not expired, not consumed, attempts<5).
//   2. Burn the OTP row.
//   3. Find or create a Supabase auth user identified by `${phone}@phone.sadisultra.local`
//      (synthetic email — we don't use Supabase phone auth because it requires
//      Twilio/MessageBird etc., and we are using OTPIQ instead).
//   4. Mint a session via the GoTrue password grant using our deterministic
//      synthetic password.

import { NextRequest } from 'next/server';
import {
  adminClient,
  hashCode,
  normalizePhone,
  syntheticEmail,
  syntheticPassword,
} from '@/lib/phone-otp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function bad(message: string, status = 400, extras: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({ message, ...extras }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
}

export async function POST(req: NextRequest) {
  let body: { phone?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return bad('JSON body مطلوب');
  }

  const phone = normalizePhone((body.phone || '').trim());
  const code = (body.code || '').trim();
  if (!/^[0-9]{10,15}$/.test(phone) || !/^[0-9]{4}$/.test(code)) {
    return bad('بيانات غير صالحة');
  }

  const supa = adminClient();

  // 1. Latest non-consumed OTP for this phone.
  const { data: rows, error: fetchErr } = await supa
    .from('phone_otp_codes')
    .select('*')
    .eq('phone', phone)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1);
  if (fetchErr) return bad('خطأ في قاعدة البيانات', 500);
  const row = rows?.[0];
  if (!row) return bad('لا يوجد رمز نشط، اطلب رمز جديد', 404);
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return bad('انتهت صلاحية الرمز، اطلب رمز جديد', 410);
  }
  if ((row.attempts ?? 0) >= 5) {
    return bad('محاولات كثيرة، اطلب رمز جديد', 429);
  }

  // 2. Hash compare.
  if (row.code_hash !== hashCode(code)) {
    await supa
      .from('phone_otp_codes')
      .update({ attempts: (row.attempts ?? 0) + 1 })
      .eq('id', row.id);
    return bad('الرمز غير صحيح', 401);
  }

  // 3. Burn the OTP.
  await supa
    .from('phone_otp_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', row.id);

  // 4. Find or create a Supabase auth user keyed by synthetic email.
  const email = syntheticEmail(phone);
  const password = syntheticPassword(phone);

  // listUsers doesn't filter by email reliably across all SDK versions; we
  // page through. For low-volume sign-ins this is fine.
  let userId: string | null = null;
  let page = 1;
  while (page < 50) {
    const { data, error } = await supa.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error('listUsers error', error);
      return bad('خطأ في البحث عن المستخدم', 500);
    }
    const hit = data.users.find((u) => u.email === email);
    if (hit) {
      userId = hit.id;
      break;
    }
    if (data.users.length < 200) break;
    page += 1;
  }

  if (!userId) {
    const created = await supa.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      phone,
      phone_confirm: true,
      user_metadata: { phone, signup_method: 'phone_otp' },
    });
    if (created.error || !created.data.user) {
      console.error('createUser failed', created.error);
      return bad('فشل إنشاء الحساب', 500, { detail: created.error?.message });
    }
    userId = created.data.user.id;
  } else {
    // Make sure the password is still our deterministic one — if the user
    // existed from a prior flow with a different password we'd otherwise
    // fail to sign them in. Idempotent.
    await supa.auth.admin.updateUserById(userId, { password });
  }

  // 5. Sign in with the synthetic credentials to get a real session
  //    (access_token + refresh_token).
  const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  if (!tokenRes.ok) {
    const detail = await tokenRes.text().catch(() => '');
    console.error('token grant failed', tokenRes.status, detail);
    return bad('فشل إنشاء الجلسة', 500, { detail });
  }
  const tok = await tokenRes.json();

  return new Response(
    JSON.stringify({
      user_id: userId,
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expires_in: tok.expires_in,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}
