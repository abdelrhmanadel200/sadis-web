export interface Profile {
  id: string;
  phone: string | null;
  name: string | null;
  city: string | null;
  branch: 'scientific' | 'literary';
  avatar_url: string | null;
  subscription_tier: 'free' | 'basic' | 'premium';
  subscription_expires_at: string | null;
  night_mode: boolean;
  created_at: string;
}

export interface Subject {
  id: string;
  name_ar: string;
  name_en: string | null;
  branch: string;
  color: string | null;
  icon: string | null;
  sort_order: number;
}

export interface ChatSession {
  id: string;
  user_id: string;
  subject_id: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  user_id: string;
  subject_id: string | null;
  role: 'user' | 'assistant';
  content: string;
  image_url: string | null;
  created_at: string;
}

/** فروع متجر المستلزمات. 'digital' = منتجات رقمية قديمة مخفية. */
export type StoreCategory = 'books' | 'booklets' | 'stationery' | 'notebooks';

export interface Product {
  id: string;
  /** 'physical' = منتج في متجر المستلزمات. الأنواع الأخرى قديمة ومخفية. */
  type: 'physical' | 'book' | 'summary' | 'video';
  category: StoreCategory | 'digital';
  subject_id: string | null;
  title: string;
  description: string | null;
  /** المؤلف أو الأستاذ */
  teacher_name: string | null;
  /** نسخة من images[0] (يملؤها trigger في القاعدة) */
  thumbnail_url: string | null;
  images: string[];
  price_iqd: number;
  /** السعر قبل الخصم */
  compare_at_price_iqd: number | null;
  /** null = غير محدود */
  stock: number | null;
  max_per_order: number;
  is_active: boolean;
  sort_order: number;
  sku: string | null;
  created_at: string;
  updated_at: string;
  // أعمدة قديمة لا يستخدمها المتجر
  content_url?: string | null;
  is_free?: boolean;
  chapter_order?: number | null;
}

export type StoreOrderStatus = 'new' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export interface StoreOrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  /** نسخة وقت الطلب */
  title: string;
  image_url: string | null;
  category: string | null;
  unit_price_iqd: number;
  qty: number;
  line_total_iqd: number;
  stock_reserved: boolean;
  created_at: string;
}

export interface StoreOrder {
  id: string;
  order_no: number;
  user_id: string | null;
  client_token: string | null;
  status: StoreOrderStatus;
  customer_name: string;
  /** +9647XXXXXXXXX */
  phone: string;
  alt_phone: string | null;
  governorate: string;
  area: string;
  /** أقرب نقطة دالة */
  address: string | null;
  notes: string | null;
  payment_method: 'cod';
  items_count: number;
  subtotal_iqd: number;
  delivery_fee_iqd: number;
  total_iqd: number;
  cancel_reason: string | null;
  cancelled_by: 'customer' | 'admin' | null;
  confirmed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  store_order_items?: StoreOrderItem[];
}

/** نتيجة place_store_order */
export interface PlaceStoreOrderResult {
  id: string;
  order_no: number;
  total_iqd: number;
  repeated?: boolean;
}

/** نظام الشراء الرقمي القديم (غير مستخدم). */
export interface Purchase {
  id: string;
  user_id: string;
  product_id: string;
  amount_iqd: number;
  payment_method: string;
  payment_status: 'pending' | 'success' | 'failed' | 'refunded';
  coupon_code: string | null;
  created_at: string;
  product?: Product;
}
