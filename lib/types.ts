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

export interface Product {
  id: string;
  type: 'book' | 'summary' | 'video';
  subject_id: string | null;
  title: string;
  description: string | null;
  teacher_name: string | null;
  thumbnail_url: string | null;
  content_url: string | null;
  price_iqd: number;
  is_free: boolean;
  chapter_order: number | null;
}

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
