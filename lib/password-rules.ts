// قواعد كلمة المرور، نفسها في المتصفح والسيرفر وتطبيق الموبايل.
// لا تستورد شيئا من Node هنا: الملف يستعمل في صفحات العميل أيضا.

import { toAsciiDigits } from '@/lib/iraq';

export const PASSWORD_MIN_CHARS = 8;
/** حد bcrypt و Supabase Auth بالبايت (UTF-8). */
export const PASSWORD_MAX_BYTES = 72;

export const PASSWORD_MISMATCH_MESSAGE = 'كلمتا المرور غير متطابقتين.';

/**
 * نفس الكلمة من لوحة مفاتيح عربية أو إنجليزية: توحيد NFC وتحويل الأرقام
 * العربية والفارسية إلى 0-9. لا نحذف المسافات (القاعدة ترفضها في الطرفين).
 */
export function normalizePasswordInput(pw: string | null | undefined): string {
  return toAsciiDigits((pw ?? '').normalize('NFC'));
}

// أي حرف بأي لغة (عربي أو إنجليزي...). RegExp بدل /.../u لأن هدف tsconfig قديم.
const LETTER_RE = new RegExp('\\p{L}', 'u');

function utf8Bytes(s: string): number {
  return new TextEncoder().encode(s).length;
}

/** رسالة عربية بالخطأ الأول، أو null إن كانت الكلمة مقبولة. */
export function passwordRuleError(raw: string | null | undefined): string | null {
  const pw = normalizePasswordInput(raw);
  if (Array.from(pw).length < PASSWORD_MIN_CHARS) {
    return `كلمة المرور يجب ألا تقل عن ${PASSWORD_MIN_CHARS} أحرف.`;
  }
  if (utf8Bytes(pw) > PASSWORD_MAX_BYTES) {
    return 'كلمة المرور طويلة جدا، اختر كلمة أقصر.';
  }
  if (pw !== pw.trim()) {
    return 'كلمة المرور لا يجوز أن تبدأ أو تنتهي بمسافة.';
  }
  if (!LETTER_RE.test(pw) || !/[0-9]/.test(pw)) {
    return 'كلمة المرور يجب أن تحتوي على حرف ورقم على الأقل.';
  }
  return null;
}
