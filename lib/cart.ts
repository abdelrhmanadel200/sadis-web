'use client';

// سلة المتجر: معرفات المنتجات والكميات فقط (الأسعار دائما من القاعدة).
// كل وصول للتخزين داخل try/catch: WebView أو التصفح الخاص قد يمنع localStorage،
// وعندها تبقى السلة في الذاكرة طوال الجلسة.

import { useSyncExternalStore } from 'react';

export const CART_STORAGE_KEY = 'sadis_store_cart_v1';
export const CART_EVENT = 'sadis:cart-change';

/** أقصى عدد أصناف في السلة (نفس حد place_store_order) */
export const CART_MAX_LINES = 50;
/** أقصى كمية للصنف الواحد (نفس قيد القاعدة) */
export const CART_MAX_QTY = 99;

export interface CartItem {
  product_id: string;
  qty: number;
}

export interface Cart {
  items: CartItem[];
}

const EMPTY_CART: Cart = Object.freeze({ items: [] }) as Cart;
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// نسخة احتياطية في الذاكرة عندما يفشل التخزين
let memoryOnly = false;
let memoryRaw: string | null = null;

// لقطة مخزنة: نفس النص = نفس الكائن، حتى لا يدور useSyncExternalStore
let cachedRaw: string | null | undefined;
let cachedCart: Cart = EMPTY_CART;

function readRaw(): string | null {
  if (memoryOnly) return memoryRaw;
  try {
    return window.localStorage.getItem(CART_STORAGE_KEY);
  } catch {
    memoryOnly = true;
    return memoryRaw;
  }
}

function writeRaw(raw: string | null) {
  memoryRaw = raw;
  if (memoryOnly) return;
  try {
    if (raw === null) window.localStorage.removeItem(CART_STORAGE_KEY);
    else window.localStorage.setItem(CART_STORAGE_KEY, raw);
  } catch {
    memoryOnly = true;
  }
}

function clampQty(n: unknown): number {
  const q = typeof n === 'number' ? Math.floor(n) : parseInt(String(n), 10);
  if (!Number.isFinite(q)) return 0;
  return Math.max(0, Math.min(CART_MAX_QTY, q));
}

function parseCart(raw: string | null): Cart {
  if (!raw) return EMPTY_CART;
  try {
    const parsed = JSON.parse(raw) as { items?: unknown };
    if (!parsed || !Array.isArray(parsed.items)) return EMPTY_CART;
    const merged = new Map<string, number>();
    for (const it of parsed.items as { product_id?: unknown; qty?: unknown }[]) {
      if (!it || typeof it.product_id !== 'string' || !ID_RE.test(it.product_id)) continue;
      const id = it.product_id.toLowerCase();
      const q = clampQty(it.qty);
      if (q < 1) continue;
      merged.set(id, Math.min(CART_MAX_QTY, (merged.get(id) ?? 0) + q));
    }
    const items = Array.from(merged, ([product_id, qty]) => ({ product_id, qty })).slice(
      0,
      CART_MAX_LINES,
    );
    return items.length ? { items } : EMPTY_CART;
  } catch {
    return EMPTY_CART;
  }
}

/** السلة الحالية (نفس الكائن ما دام المخزن لم يتغير) */
export function getCart(): Cart {
  if (typeof window === 'undefined') return EMPTY_CART;
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedCart = parseCart(raw);
  }
  return cachedCart;
}

function saveCart(items: CartItem[]) {
  if (typeof window === 'undefined') return;
  const clean = items.filter((i) => i.qty >= 1).slice(0, CART_MAX_LINES);
  writeRaw(clean.length ? JSON.stringify({ items: clean }) : null);
  try {
    window.dispatchEvent(new Event(CART_EVENT));
  } catch {
    // متصفحات قديمة جدا
  }
}

/**
 * يضيف كمية للمنتج مع حد أعلى اختياري (المخزون أو الحد لكل طلب).
 * يرجع الكمية الجديدة في السلة.
 */
export function addToCart(productId: string, qty = 1, max: number = CART_MAX_QTY): number {
  const id = productId.toLowerCase();
  if (!ID_RE.test(id)) return 0;
  const limit = Math.max(0, Math.min(CART_MAX_QTY, Math.floor(max)));
  const items = getCart().items.slice();
  const idx = items.findIndex((i) => i.product_id === id);
  const current = idx >= 0 ? items[idx].qty : 0;
  const next = Math.min(limit, current + Math.max(1, clampQty(qty)));
  if (next < 1) return current;
  if (idx >= 0) {
    items[idx] = { product_id: id, qty: next };
  } else {
    if (items.length >= CART_MAX_LINES) return 0;
    items.push({ product_id: id, qty: next });
  }
  saveCart(items);
  return next;
}

/** يضبط الكمية، والصفر يحذف المنتج */
export function setQty(productId: string, qty: number) {
  const id = productId.toLowerCase();
  const q = clampQty(qty);
  const items = getCart().items.slice();
  const idx = items.findIndex((i) => i.product_id === id);
  if (q < 1) {
    if (idx < 0) return;
    items.splice(idx, 1);
  } else if (idx >= 0) {
    if (items[idx].qty === q) return;
    items[idx] = { product_id: id, qty: q };
  } else {
    if (items.length >= CART_MAX_LINES) return;
    items.push({ product_id: id, qty: q });
  }
  saveCart(items);
}

export function removeFromCart(productId: string) {
  setQty(productId, 0);
}

export function clearCart() {
  saveCart([]);
}

export function cartCount(cart: Cart): number {
  return cart.items.reduce((sum, i) => sum + i.qty, 0);
}

export function cartQtyOf(cart: Cart, productId: string): number {
  const id = productId.toLowerCase();
  return cart.items.find((i) => i.product_id === id)?.qty ?? 0;
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === CART_STORAGE_KEY) onChange();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(CART_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(CART_EVENT, onChange);
  };
}

const getServerCart = () => EMPTY_CART;

/** السلة كحالة React تتحدث مع كل تغيير (وفي التبويبات الأخرى) */
export function useCart(): Cart {
  return useSyncExternalStore(subscribe, getCart, getServerCart);
}

const noopSubscribe = () => () => {};

/** false أثناء العرض على الخادم وأول hydration، حتى لا تظهر السلة فارغة لحظيا */
export function useCartReady(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
