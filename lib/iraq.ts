// أدوات عراقية مشتركة: المحافظات، توحيد أرقام الموبايل، تنسيق الدينار، رابط واتساب.
// يجب أن تطابق قائمة المحافظات والتوحيد ما في قاعدة البيانات
// (store_orders.governorate و store_normalize_iq_phone).

export const GOVERNORATES = [
  'بغداد', 'البصرة', 'نينوى', 'أربيل', 'النجف', 'كربلاء', 'بابل',
  'ذي قار', 'الأنبار', 'ديالى', 'كركوك', 'واسط', 'صلاح الدين',
  'القادسية', 'المثنى', 'ميسان', 'دهوك', 'السليمانية', 'حلبجة',
] as const;

export type Governorate = (typeof GOVERNORATES)[number];

/** يحول الأرقام العربية والفارسية إلى 0-9. */
export function toAsciiDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/**
 * رقم موبايل عراقي بصيغة +9647XXXXXXXXX، أو null إن لم يكن صالحا.
 * يقبل: 07XXXXXXXXX، 7XXXXXXXXX، 9647XXXXXXXXX، +9647..، 009647..، +964 07..
 * (الصيغة الأخيرة يكتبها كثيرون بزيادة صفر بعد مفتاح الدولة).
 */
export function normalizeIraqPhone(raw: string | null | undefined): string | null {
  let d = toAsciiDigits(raw ?? '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (/^9647\d{9}$/.test(d)) return '+' + d;
  if (/^96407\d{9}$/.test(d)) return '+964' + d.slice(4);
  if (/^07\d{9}$/.test(d)) return '+964' + d.slice(1);
  if (/^7\d{9}$/.test(d)) return '+964' + d;
  return null;
}

/** 250000 → "250,000 د.ع" بأرقام عربية حسب لغة العراق. */
export function formatIQD(n: number | null | undefined): string {
  return `${Math.round(n ?? 0).toLocaleString('ar-IQ')} د.ع`;
}

/** رابط محادثة واتساب مع نص جاهز. الرقم بأي صيغة، تبقى الأرقام فقط. */
export function waLink(phone: string, text: string): string {
  const digits = toAsciiDigits(phone).replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
