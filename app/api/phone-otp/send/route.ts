// POST /api/phone-otp/send
//
// Body: { phone: string }   // E.164 with or without leading +, e.g. "+9647700000000" or "20100..."
// - Generates a 4-digit OTP, stores a hashed copy in `phone_otp_codes`.
// - Sends the code over SMS via OTPIQ (provider: "sms").
// - Throttled to 1 SMS / 60s per phone.

import { NextRequest } from 'next/server';
import {
  adminClient,
  generateCode,
  hashCode,
  normalizePhone,
} from '@/lib/phone-otp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OTPIQ_API_KEY = process.env.OTPIQ_API_KEY!;
const OTPIQ_SENDER_ID = process.env.OTPIQ_SENDER_ID; // optional, default = OTPIQ-managed
const OTPIQ_ENDPOINT = 'https://api.otpiq.com/api/sms';

// Per-phone send rate limit.
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX = 1;
// How long a freshly-generated code is valid.
const CODE_TTL_SECONDS = 300;

function bad(message: string, status = 400, extras: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({ message, ...extras }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
}

export async function POST(req: NextRequest) {
  let body: { phone?: string };
  try {
    body = await req.json();
  } catch {
    return bad('JSON body مطلوب');
  }

  const phoneRaw = (body.phone || '').trim();
  const phone = normalizePhone(phoneRaw);
  // 10-15 digits per OTPIQ spec; covers IQ (+964…), EG (+20…), etc.
  if (!/^[0-9]{10,15}$/.test(phone)) {
    return bad('رقم الهاتف غير صالح');
  }

  const supa = adminClient();

  // Rate limit: deny if a code was already sent to this phone recently.
  const windowStart = new Date(
    Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000,
  ).toISOString();
  const { count: recentCount, error: recentErr } = await supa
    .from('phone_otp_codes')
    .select('*', { count: 'exact', head: true })
    .eq('phone', phone)
    .gte('created_at', windowStart);
  if (recentErr) {
    return bad('تعذّر التحقق من حالة الإرسال', 500);
  }
  if ((recentCount ?? 0) >= RATE_LIMIT_MAX) {
    return bad('انتظر قليلاً قبل إعادة إرسال الرمز', 429);
  }

  const code = generateCode();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString();

  // Persist BEFORE sending so a successful SMS without a matching DB row is
  // impossible. If OTPIQ fails the row simply expires.
  const { error: insertErr } = await supa.from('phone_otp_codes').insert({
    phone,
    code_hash: codeHash,
    expires_at: expiresAt,
  });
  if (insertErr) {
    return bad('تعذّر إنشاء الرمز', 500, { detail: insertErr.message });
  }

  // Send via OTPIQ. We pin provider: 'sms' for now to keep cost predictable;
  // switch to 'auto' once OTPIQ + WhatsApp Business is wired up.
  const otpiqBody: Record<string, unknown> = {
    smsType: 'verification',
    phoneNumber: phone,
    verificationCode: code,
    provider: 'sms',
  };
  if (OTPIQ_SENDER_ID) otpiqBody.senderId = OTPIQ_SENDER_ID;

  try {
    const otpiqRes = await fetch(OTPIQ_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OTPIQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(otpiqBody),
    });
    if (!otpiqRes.ok) {
      const detail = await otpiqRes.text().catch(() => '');
      console.error('OTPIQ send failed', otpiqRes.status, detail);
      return bad('فشل إرسال الرسالة، حاول مرة أخرى', 502, { detail });
    }
  } catch (e) {
    console.error('OTPIQ network error', e);
    return bad('فشل إرسال الرسالة، تحقق من الاتصال', 502);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
