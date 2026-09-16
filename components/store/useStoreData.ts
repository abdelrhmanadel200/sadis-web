'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { removeFromCart, setQty, useCart, useCartReady, type Cart } from '@/lib/cart';
import {
  DEFAULT_STORE_SETTINGS,
  PRODUCT_COLUMNS,
  fetchStoreSettings,
  isSellable,
  productMaxQty,
  type StoreProduct,
  type StoreSettings,
} from '@/lib/store';

// ── إعدادات المتجر (نخزنها دقيقة واحدة بين الصفحات) ──
let settingsCache: { at: number; value: StoreSettings } | null = null;
const SETTINGS_TTL_MS = 60_000;

export function useStoreSettings(): { settings: StoreSettings; loading: boolean } {
  const fresh = settingsCache && Date.now() - settingsCache.at < SETTINGS_TTL_MS;
  const [settings, setSettings] = useState<StoreSettings>(
    fresh && settingsCache ? settingsCache.value : DEFAULT_STORE_SETTINGS,
  );
  const [loading, setLoading] = useState(!fresh);

  useEffect(() => {
    if (settingsCache && Date.now() - settingsCache.at < SETTINGS_TTL_MS) {
      setSettings(settingsCache.value);
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchStoreSettings().then((s) => {
      if (s.loaded) settingsCache = { at: Date.now(), value: s };
      if (!cancelled) {
        setSettings(s);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { settings, loading };
}

// ── منتجات السلة من القاعدة ──
export interface CartLine {
  product: StoreProduct;
  qty: number;
  maxQty: number;
  lineTotal: number;
}

export interface CartProductsState {
  /** السلة قرئت من التخزين */
  ready: boolean;
  cart: Cart;
  lines: CartLine[];
  subtotal: number;
  itemsCount: number;
  /** أول تحميل للمنتجات */
  loading: boolean;
  /** السلة تغيرت والمنتجات تحدث الآن */
  syncing: boolean;
  error: string | null;
  notices: string[];
  dismissNotices: () => void;
  reload: () => void;
}

/**
 * يجلب منتجات السلة بأسعارها الحالية، ويحذف غير المتوفر، ويضبط الكميات
 * على المخزون والحد لكل طلب، مع رسالة للطالب عن كل تعديل.
 */
export function useCartProducts(): CartProductsState {
  const cart = useCart();
  const ready = useCartReady();
  const key = useMemo(
    () => cart.items.map((i) => i.product_id).sort().join(','),
    [cart],
  );

  const [products, setProducts] = useState<Record<string, StoreProduct>>({});
  const [fetchedKey, setFetchedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!ready) return;
    if (!key) {
      setProducts({});
      setFetchedKey('');
      setError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase
        .from('products')
        .select(PRODUCT_COLUMNS)
        .in('id', key.split(','));
      if (cancelled) return;
      if (err) {
        setError(err.message || 'تعذر تحميل منتجات السلة');
        return;
      }
      const map: Record<string, StoreProduct> = {};
      for (const p of (data ?? []) as unknown as StoreProduct[]) map[p.id.toLowerCase()] = p;
      setProducts(map);
      setError(null);
      setFetchedKey(key);
    })();
    return () => {
      cancelled = true;
    };
  }, [key, ready, tick]);

  // تصحيح السلة بعد وصول المنتجات لنفس المجموعة من المعرفات
  useEffect(() => {
    if (!ready || fetchedKey === null || fetchedKey !== key) return;
    const msgs: string[] = [];
    let missing = 0;
    for (const item of cart.items) {
      const p = products[item.product_id];
      if (!p || !isSellable(p)) {
        removeFromCart(item.product_id);
        missing += 1;
        continue;
      }
      const max = productMaxQty(p);
      if (max === 0) {
        removeFromCart(item.product_id);
        msgs.push(`نفد "${p.title}" فحذفناه من السلة.`);
      } else if (item.qty > max) {
        setQty(item.product_id, max);
        msgs.push(
          `عدلنا كمية "${p.title}" إلى ${max.toLocaleString('ar-IQ')} لأنها أقصى كمية متاحة.`,
        );
      }
    }
    if (missing > 0) {
      msgs.unshift(
        missing === 1
          ? 'حذفنا منتجا من السلة لأنه لم يعد متوفرا.'
          : `حذفنا ${missing.toLocaleString('ar-IQ')} منتجات من السلة لأنها لم تعد متوفرة.`,
      );
    }
    if (msgs.length) {
      setNotices((prev) => Array.from(new Set([...prev, ...msgs])));
    }
  }, [ready, fetchedKey, key, cart, products]);

  const lines = useMemo<CartLine[]>(() => {
    const out: CartLine[] = [];
    for (const item of cart.items) {
      const p = products[item.product_id];
      if (!p || !isSellable(p)) continue;
      const maxQty = productMaxQty(p);
      if (maxQty === 0) continue;
      const qty = Math.min(item.qty, maxQty);
      out.push({ product: p, qty, maxQty, lineTotal: qty * p.price_iqd });
    }
    return out;
  }, [cart, products]);

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const itemsCount = lines.reduce((s, l) => s + l.qty, 0);

  const dismissNotices = useCallback(() => setNotices([]), []);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  return {
    ready,
    cart,
    lines,
    subtotal,
    itemsCount,
    loading: !ready || (key !== '' && fetchedKey === null && !error),
    syncing: ready && fetchedKey !== key,
    error,
    notices,
    dismissNotices,
    reload,
  };
}
