// متجر المستلزمات: الفروع، حالات الطلب، إعدادات المتجر، وتقدير أجرة التوصيل.
// الأسعار والأجرة النهائية تحسبها place_store_order في القاعدة، وما هنا للعرض فقط.

import { supabase } from '@/lib/supabase';
import type { Product, StoreCategory, StoreOrderStatus } from '@/lib/types';

export const STORE_CATEGORIES: { id: StoreCategory; label: string }[] = [
  { id: 'books', label: 'كتب' },
  { id: 'booklets', label: 'ملازم' },
  { id: 'stationery', label: 'قرطاسية' },
  { id: 'notebooks', label: 'دفاتر' },
];

export const STORE_CATEGORY_IDS: StoreCategory[] = STORE_CATEGORIES.map((c) => c.id);

/** الفروع التي يظهر فيها فلتر المادة */
export const SUBJECT_CATEGORIES: StoreCategory[] = ['books', 'booklets'];

export function storeCategoryLabel(id: string | null | undefined): string {
  return STORE_CATEGORIES.find((c) => c.id === id)?.label ?? '';
}

export function isStoreCategory(id: unknown): id is StoreCategory {
  return typeof id === 'string' && (STORE_CATEGORY_IDS as string[]).includes(id);
}

// ── حالات الطلب (بصياغة الطالب) ──
export const ORDER_STATUS: Record<StoreOrderStatus, { label: string; badge: string }> = {
  new: {
    label: 'قيد المراجعة',
    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  },
  confirmed: {
    label: 'تم التأكيد',
    badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  },
  shipped: {
    label: 'قيد التوصيل',
    badge: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
  },
  delivered: {
    label: 'تم التسليم',
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  },
  cancelled: {
    label: 'ملغى',
    badge: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  },
};

/** مراحل الطلب بالترتيب (الإلغاء خارجها) */
export const ORDER_STEPS: Exclude<StoreOrderStatus, 'cancelled'>[] = [
  'new',
  'confirmed',
  'shipped',
  'delivered',
];

export function orderStatusLabel(s: string): string {
  return ORDER_STATUS[s as StoreOrderStatus]?.label ?? s;
}

// ── المنتجات ──
/** أعمدة المنتج التي تحتاجها صفحات المتجر */
export const PRODUCT_COLUMNS =
  'id,type,category,subject_id,title,description,teacher_name,thumbnail_url,images,price_iqd,compare_at_price_iqd,stock,max_per_order,is_active,sort_order,created_at';

export type StoreProduct = Pick<
  Product,
  | 'id'
  | 'type'
  | 'category'
  | 'subject_id'
  | 'title'
  | 'description'
  | 'teacher_name'
  | 'thumbnail_url'
  | 'images'
  | 'price_iqd'
  | 'compare_at_price_iqd'
  | 'stock'
  | 'max_per_order'
  | 'is_active'
  | 'sort_order'
  | 'created_at'
>;

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** منتج صالح للبيع في المتجر (نشط، مادي، ضمن الفروع الأربعة) */
export function isSellable(p: Pick<StoreProduct, 'type' | 'category' | 'is_active'>): boolean {
  return p.type === 'physical' && p.is_active !== false && isStoreCategory(p.category);
}

export function productImages(p: Pick<StoreProduct, 'images' | 'thumbnail_url'>): string[] {
  const list = (Array.isArray(p.images) ? p.images : []).filter(
    (u): u is string => typeof u === 'string' && u.length > 0,
  );
  if (list.length === 0 && p.thumbnail_url) return [p.thumbnail_url];
  return list;
}

export function productCover(p: Pick<StoreProduct, 'images' | 'thumbnail_url'>): string | null {
  return productImages(p)[0] ?? null;
}

/** أكبر كمية يطلبها الطالب من المنتج: الأقل بين المخزون والحد لكل طلب */
export function productMaxQty(p: Pick<StoreProduct, 'stock' | 'max_per_order'>): number {
  const perOrder = Math.max(1, Math.min(99, Math.floor(p.max_per_order || 20)));
  if (p.stock === null || p.stock === undefined) return perOrder;
  return Math.max(0, Math.min(perOrder, Math.floor(p.stock)));
}

export function hasDiscount(p: Pick<StoreProduct, 'price_iqd' | 'compare_at_price_iqd'>): boolean {
  return p.compare_at_price_iqd !== null && p.compare_at_price_iqd > p.price_iqd;
}

export function discountPercent(p: Pick<StoreProduct, 'price_iqd' | 'compare_at_price_iqd'>): number {
  if (!hasDiscount(p) || !p.compare_at_price_iqd) return 0;
  return Math.round((1 - p.price_iqd / p.compare_at_price_iqd) * 100);
}

/** "قطعة واحدة" / "قطعتين" / "5 قطع" / "12 قطعة" */
export function piecesLabel(n: number): string {
  if (n === 1) return 'قطعة واحدة';
  if (n === 2) return 'قطعتين';
  const num = n.toLocaleString('ar-IQ');
  return n >= 3 && n <= 10 ? `${num} قطع` : `${num} قطعة`;
}

/** "آخر قطعة" / "آخر قطعتين" / "آخر 5 قطع" */
export function lastPiecesLabel(n: number): string {
  if (n <= 1) return 'آخر قطعة';
  if (n === 2) return 'آخر قطعتين';
  return `آخر ${n.toLocaleString('ar-IQ')} قطع`;
}

/** توحيد الحروف العربية للبحث (أ إ آ = ا، ة = ه، ى = ي، بدون تشكيل) */
export function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

/** +9647XXXXXXXXX أو 9647XXXXXXXXX إلى 07XXXXXXXXX للعرض */
export function localIraqPhone(p: string | null | undefined): string {
  const d = (p ?? '').replace(/\D/g, '');
  if (/^9647\d{9}$/.test(d)) return '0' + d.slice(3);
  return p ?? '';
}

/** آخر طلب أرسل من صفحة إكمال الطلب (sessionStorage) لعرض المبلغ الراجع من القاعدة */
export const STORE_PLACED_KEY = 'sadis_store_last_placed';

// ── إعدادات المتجر (app_settings) ──
export const STORE_SETTING_KEYS = [
  'store_open',
  'store_delivery_fee_default_iqd',
  'store_delivery_fees',
  'store_free_delivery_min_iqd',
  'store_whatsapp',
] as const;

export interface StoreSettings {
  /** false = لم تحمل الإعدادات بعد أو فشل تحميلها، فلا نعرض أجرة تقديرية */
  loaded: boolean;
  open: boolean;
  /** الأجرة الافتراضية، null إن لم تضبط */
  defaultFee: number | null;
  /** أجرة خاصة لكل محافظة */
  fees: Record<string, number>;
  /** 0 = بدون توصيل مجاني */
  freeMin: number;
  /** أرقام فقط، فارغ = بدون زر واتساب */
  whatsapp: string;
}

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  loaded: false,
  open: true,
  defaultFee: null,
  fees: {},
  freeMin: 0,
  whatsapp: '',
};

/** مثل تحويل ::int في القاعدة: عدد صحيح أو null */
function toInt(v: unknown): number | null {
  if (typeof v === 'number') return Number.isInteger(v) ? v : null;
  if (typeof v === 'string' && /^\s*[+-]?\d{1,9}\s*$/.test(v)) return parseInt(v, 10);
  return null;
}

export async function fetchStoreSettings(): Promise<StoreSettings> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', STORE_SETTING_KEYS as unknown as string[]);
    if (error || !data) return { ...DEFAULT_STORE_SETTINGS };

    const map = new Map<string, string | null>();
    for (const row of data as { key: string; value: string | null }[]) {
      map.set(row.key, row.value);
    }

    const fees: Record<string, number> = {};
    try {
      const raw = map.get('store_delivery_fees');
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [gov, fee] of Object.entries(parsed as Record<string, unknown>)) {
          const n = toInt(fee);
          if (n !== null) fees[gov] = n;
        }
      }
    } catch {
      // JSON تالف: القاعدة ترجع للأجرة الافتراضية، ونحن كذلك
    }

    const openRaw = map.get('store_open');
    return {
      loaded: true,
      // نفس منطق القاعدة: غياب المفتاح = مفتوح
      open: (openRaw ?? 'true').trim() === 'true',
      defaultFee: toInt(map.get('store_delivery_fee_default_iqd') ?? null),
      fees,
      freeMin: Math.max(0, toInt(map.get('store_free_delivery_min_iqd') ?? null) ?? 0),
      whatsapp: (map.get('store_whatsapp') ?? '').replace(/\D/g, ''),
    };
  } catch {
    return { ...DEFAULT_STORE_SETTINGS };
  }
}

/**
 * أجرة التوصيل التقديرية (للعرض فقط، نفس منطق place_store_order).
 * null = لا نعرف بعد (لم تختر محافظة أو تعذر تحميل الإعدادات).
 */
export function estimateDeliveryFee(
  settings: StoreSettings,
  governorate: string | null | undefined,
  subtotal: number,
): number | null {
  if (!settings.loaded || !governorate) return null;
  const perGov = Object.prototype.hasOwnProperty.call(settings.fees, governorate)
    ? settings.fees[governorate]
    : null;
  let fee = Math.max(perGov ?? settings.defaultFee ?? 0, 0);
  if (settings.freeMin > 0 && subtotal >= settings.freeMin) fee = 0;
  return fee;
}

/** مبلغ باقي للتوصيل المجاني، أو 0 */
export function remainingForFreeDelivery(settings: StoreSettings, subtotal: number): number {
  if (!settings.loaded || settings.freeMin <= 0) return 0;
  return Math.max(0, settings.freeMin - subtotal);
}

/** تاريخ الطلب بتوقيت بغداد */
export function formatOrderDate(iso: string | null | undefined, withTime = true): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('ar-IQ', {
      timeZone: 'Asia/Baghdad',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
    });
  } catch {
    return new Date(iso).toLocaleDateString('ar-IQ');
  }
}
