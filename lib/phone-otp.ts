import { randomInt, createHmac } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { toAsciiDigits } from '@/lib/iraq';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OTP_PEPPER_ENV = process.env.OTP_PEPPER || '';
// القيمة القديمة تبقى احتياطا حتى لا تفشل الرموز المرسلة، مع تنبيه في السجل.
const OTP_PEPPER = OTP_PEPPER_ENV || 'change-me-in-prod';

let pepperWarned = false;
function warnMissingPepper() {
  if (OTP_PEPPER_ENV || pepperWarned) return;
  pepperWarned = true;
  console.error('phone-otp: OTP_PEPPER is not set, using the insecure fallback. Set OTP_PEPPER in the environment.');
}

/** Admin client, used only by server routes. Never expose. */
export function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * الصيغة الموحدة للرقم: أرقام فقط بدون + (مثل 9647701234567)، وهي المخزنة في
 * auth.users.phone و profiles.phone. يقبل الأرقام العربية والفارسية، و 00 قبل
 * مفتاح الدولة، والصفر الزائد بعد 964، والرقم المحلي 07XXXXXXXXX و 7XXXXXXXXX.
 * نفس القواعد في صفحة الدخول وصفحة حسابي.
 */
export function normalizePhone(phone: string): string {
  let d = toAsciiDigits(phone || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('9640')) d = '964' + d.slice(4);
  if (d.length === 11 && d.startsWith('0')) d = '964' + d.slice(1);
  else if (/^7\d{9}$/.test(d)) d = '964' + d;
  return d;
}

/** 4-digit numeric code, leading zeros allowed (e.g. "0427"). */
export function generateCode(): string {
  return randomInt(0, 10000).toString().padStart(4, '0');
}

/** Hash an OTP with the server-side pepper. */
export function hashCode(code: string): string {
  warnMissingPepper();
  return createHmac('sha256', OTP_PEPPER).update(code).digest('hex');
}

/** Stable Supabase user email derived from phone. Required because Supabase
 *  Auth needs a unique identifier per user; we synthesize one from the phone
 *  number so the same phone always lands on the same auth.user row. */
export function syntheticEmail(phone: string): string {
  const normalized = normalizePhone(phone);
  return `${normalized}@phone.sadisultra.local`;
}
