'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Plus } from 'lucide-react';
import { addToCart, cartQtyOf, useCart, useCartReady } from '@/lib/cart';
import {
  discountPercent,
  hasDiscount,
  lastPiecesLabel,
  productCover,
  productMaxQty,
  storeCategoryLabel,
  type StoreProduct,
} from '@/lib/store';
import { Price, ProductThumb } from '@/components/store/ProductVisuals';

export default function ProductCard({
  product,
  storeOpen,
}: {
  product: StoreProduct;
  storeOpen: boolean;
}) {
  const cart = useCart();
  const ready = useCartReady();
  const inCart = ready ? cartQtyOf(cart, product.id) : 0;
  const maxQty = productMaxQty(product);
  const soldOut = maxQty === 0;
  const atLimit = !soldOut && inCart >= maxQty;
  const lowStock = !soldOut && product.stock !== null && product.stock <= 5;
  const href = `/store/product/${product.id}`;

  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const onAdd = () => {
    if (!storeOpen || soldOut || atLimit) return;
    addToCart(product.id, 1, maxQty);
    setAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 1600);
  };

  let label: React.ReactNode = (
    <>
      <Plus className="w-4 h-4" />
      أضف للسلة
    </>
  );
  if (soldOut) label = 'نفد من المخزن';
  else if (!storeOpen) label = 'الطلب متوقف';
  else if (added)
    label = (
      <>
        <Check className="w-4 h-4" />
        أضيف للسلة
      </>
    );
  else if (atLimit) label = 'وصلت للحد الأقصى';

  return (
    <div className="card border border-dark-border rounded-2xl overflow-hidden flex flex-col hover:border-primary/50 transition">
      <Link href={href} className="relative block aspect-[4/5] overflow-hidden">
        <ProductThumb
          src={productCover(product)}
          alt={product.title}
          category={product.category}
          className={soldOut ? 'opacity-50 grayscale' : ''}
        />
        <div className="absolute top-2 inset-x-2 flex items-start justify-between gap-1 pointer-events-none">
          {soldOut ? (
            <span className="text-[11px] font-bold bg-red-600 text-white px-2 py-0.5 rounded-full">
              نفد
            </span>
          ) : lowStock ? (
            <span className="text-[11px] font-bold bg-amber-500 text-black px-2 py-0.5 rounded-full">
              {lastPiecesLabel(product.stock ?? 0)}
            </span>
          ) : (
            <span />
          )}
          {hasDiscount(product) && (
            <span className="text-[11px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
              خصم {discountPercent(product).toLocaleString('ar-IQ')}٪
            </span>
          )}
        </div>
        <span className="absolute bottom-2 start-2 text-[10px] font-semibold bg-black/60 text-white px-2 py-0.5 rounded-full">
          {storeCategoryLabel(product.category)}
        </span>
      </Link>

      <div className="p-3 flex-1 flex flex-col">
        <Link href={href} className="hover:opacity-85">
          <h3 className="font-cairo font-bold text-sm leading-snug line-clamp-2">{product.title}</h3>
        </Link>
        {product.teacher_name && (
          <p className="text-xs text-muted line-clamp-1 mt-0.5">{product.teacher_name}</p>
        )}
        <Price
          price={product.price_iqd}
          compareAt={product.compare_at_price_iqd}
          className="mt-auto pt-2"
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={!storeOpen || soldOut || atLimit}
          className={`mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-bold transition disabled:cursor-not-allowed ${
            added
              ? 'bg-emerald-600 text-white'
              : 'bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-45'
          }`}
        >
          {label}
        </button>
        {inCart > 0 && !added && (
          <Link href="/store/cart" className="mt-1.5 text-[11px] text-center text-muted hover:underline">
            في سلتك: {inCart.toLocaleString('ar-IQ')}
          </Link>
        )}
      </div>
    </div>
  );
}
