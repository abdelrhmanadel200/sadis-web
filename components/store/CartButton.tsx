'use client';

import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { cartCount, useCart, useCartReady } from '@/lib/cart';

function useCount(): number {
  const cart = useCart();
  const ready = useCartReady();
  return ready ? cartCount(cart) : 0;
}

function CountBadge({ count }: { count: number }) {
  return (
    <span className="min-w-[1.25rem] h-5 px-1 rounded-full bg-primary text-primary-foreground text-[11px] font-bold inline-flex items-center justify-center tabular-nums">
      {count > 99 ? '+٩٩' : count.toLocaleString('ar-IQ')}
    </span>
  );
}

/** زر السلة مع العدد (لرأس الصفحة) */
export function CartButton({ className = '' }: { className?: string }) {
  const count = useCount();
  return (
    <Link
      href="/store/cart"
      aria-label={count > 0 ? `السلة، فيها ${count} قطعة` : 'السلة'}
      className={`inline-flex items-center gap-2 rounded-xl border border-dark-border card px-3.5 py-2 text-sm font-semibold hover:border-primary/50 transition ${className}`}
    >
      <ShoppingCart className="w-4 h-4" />
      السلة
      {count > 0 && <CountBadge count={count} />}
    </Link>
  );
}

/** زر عائم للسلة يظهر فقط عندما تكون فيها منتجات */
export function CartFab() {
  const count = useCount();
  if (count === 0) return null;
  return (
    <Link
      href="/store/cart"
      aria-label={`اذهب للسلة، فيها ${count} قطعة`}
      className="fixed bottom-5 end-5 z-20 inline-flex items-center gap-2 rounded-full px-5 py-3 font-bold text-white shadow-lg shadow-black/30 bg-gradient-to-br from-[#1E66AA] to-[#1EA0D1] hover:brightness-110 transition"
    >
      <ShoppingCart className="w-5 h-5" />
      السلة
      <span className="min-w-[1.5rem] h-6 px-1.5 rounded-full bg-white text-[#1E66AA] text-xs font-extrabold inline-flex items-center justify-center tabular-nums">
        {count > 99 ? '+٩٩' : count.toLocaleString('ar-IQ')}
      </span>
    </Link>
  );
}
