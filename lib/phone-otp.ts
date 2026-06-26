import { createHash, randomInt, createHmac } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OTP_PEPPER = process.env.OTP_PEPPER || 'change-me-in-prod';

/** Admin client — used only by /api/phone-otp/* routes. Never expose. */
export function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Normalize "+9647501234567" → "9647501234567". OTPIQ wants no leading +. */
export function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

/** 4-digit numeric code, leading zeros allowed (e.g. "0427"). */
export function generateCode(): string {
  return randomInt(0, 10000).toString().padStart(4, '0');
}

/** Hash an OTP with the server-side pepper. */
export function hashCode(code: string): string {
  return createHmac('sha256', OTP_PEPPER).update(code).digest('hex');
}

/** Stable Supabase user email derived from phone. Required because Supabase
 *  Auth needs a unique identifier per user; we synthesize one from the phone
 *  number so the same phone always lands on the same auth.user row. */
export function syntheticEmail(phone: string): string {
  const normalized = normalizePhone(phone);
  return `${normalized}@phone.sadisultra.local`;
}

/** A non-throwing random password we set on the auth user. The user never
 *  signs in with it — they only get sessions through OTP verify. */
export function syntheticPassword(phone: string): string {
  return createHash('sha256').update(`${OTP_PEPPER}:${phone}`).digest('hex');
}
