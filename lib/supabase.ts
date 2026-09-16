'use client';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let client: SupabaseClient | null = null;

/**
 * الصفحة داخل WebView تطبيق الموبايل: التطبيق يضع sadis_embedded = '1' مع
 * الجلسة، وهو من يجدد التوكن، فلا نجدده هنا (سلسلة refresh token واحدة).
 */
export function isEmbeddedMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem('sadis_embedded') === '1';
  } catch {
    return false;
  }
}

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: !isEmbeddedMode(),
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}

export const supabase = getSupabase();
