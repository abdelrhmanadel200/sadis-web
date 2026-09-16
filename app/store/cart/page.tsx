'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, LogIn, RefreshCw, ShoppingCart, Trash2 } from 'lucide-react';
import StoreShell from '@/components/store/StoreShell';
import QtyStepper from '@/components/store/QtyStepper';
import { Price, ProductThumb } from '@/components/store/ProductVisuals';
import {
  GovernorateSelect,
  TotalsRows,
  loadSavedGovernorate,
} from '@/components/store/OrderSummary';
import {
  StoreBackLink,
  StoreClosedNotice,
  StoreEmpty,
  StoreNotice,
  StorePageTitle,
  primaryBtn,
} from '@/components/store/StoreParts';
import { useCartProducts, useStoreSettings } from '@/components/store/useStoreData';
import { useAuth } from '@/components/providers/AuthProvider';
import { removeFromCart, setQty as setCartQty } from '@/lib/cart';
import { formatIQD } from '@/lib/iraq';
import { productCover, storeCategoryLabel } from '@/lib/store';

// السلة عامة: الزائر يجهز سلته ويسجل دخوله عند إكمال الطلب.
export default function CartPage() {
  return (
    <StoreShell>
      <CartView />
    </StoreShell>
  );
}

const CHECKOUT_PATH = '/store/checkout';

function CartView() {
  const { user } = useAuth();
  const { settings } = useStoreSettings();
  const s = useCartProducts();
  const [gov, setGov] = useState('');

  useEffect(() => {
    setGov(loadSavedGovernorate());
  }, []);

  const showSkeleton = s.loading || (s.lines.length === 0 && s.syncing && !s.error);

  return (
    <div className="px-4 py-5 md:p-8 max-w-5xl mx-auto pb-16">
      <StoreBackLink href="/store" label="متابعة التسوق" />
      <StorePageTitle
        icon={<ShoppingCart className="w-7 h-7 text-primary-light shrink-0" />}
        title="السلة"
      />

      {!settings.open && <StoreClosedNotice className="mb-4" />}

      {s.notices.length > 0 && (
        <StoreNotice tone="warning" title="حدثنا سلتك" onClose={s.dismissNotices} className="mb-4">
          <ul className="space-y-0.5">
            {s.notices.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </StoreNotice>
      )}

      {showSkeleton ? (
        <div className="space-y-3 animate-pulse" aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className="h-28 rounded-2xl card border border-dark-border" />
          ))}
        </div>
      ) : s.error && s.lines.length === 0 ? (
        <StoreNotice tone="error" title="تعذر تحميل السلة">
          <p>{s.error}</p>
          <button
            type="button"
            onClick={s.reload}
            className="mt-2 inline-flex items-center gap-1.5 font-bold underline"
          >
            <RefreshCw className="w-4 h-4" />
            إعادة المحاولة
          </button>
        </StoreNotice>
      ) : s.lines.length === 0 ? (
        <StoreEmpty
          icon={<ShoppingCart className="w-8 h-8" />}
          title="سلتك فارغة"
          action={
            <Link href="/store" className={primaryBtn}>
              تصفح المتجر
            </Link>
          }
        >
          أضف الكتب والملازم والقرطاسية اللي تحتاجها وارجع هنا لإكمال الطلب.
        </StoreEmpty>
      ) : (
        <div className="grid lg:grid-cols-3 gap-5 items-start">
          <ul className="lg:col-span-2 space-y-3">
            {s.lines.map(({ product, qty, maxQty, lineTotal }) => {
              const href = `/store/product/${product.id}`;
              return (
                <li
                  key={product.id}
                  className="card border border-dark-border rounded-2xl p-3 flex gap-3"
                >
                  <Link
                    href={href}
                    className="w-20 h-24 shrink-0 rounded-xl overflow-hidden border border-dark-border"
                  >
                    <ProductThumb
                      src={productCover(product)}
                      alt={product.title}
                      category={product.category}
                      iconClassName="w-7 h-7 text-primary-light/70"
                    />
                  </Link>
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link href={href} className="font-cairo font-bold text-sm leading-snug line-clamp-2 hover:opacity-85">
                          {product.title}
                        </Link>
                        <p className="text-[11px] text-muted mt-0.5">
                          {storeCategoryLabel(product.category)}
                          {product.teacher_name ? ` · ${product.teacher_name}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(product.id)}
                        aria-label={`حذف ${product.title} من السلة`}
                        className="p-2 -m-1 rounded-lg text-muted hover:text-red-500 hover-surface shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <Price price={product.price_iqd} compareAt={product.compare_at_price_iqd} />
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                      <QtyStepper
                        size="sm"
                        value={qty}
                        max={maxQty}
                        onChange={(n) => setCartQty(product.id, n)}
                      />
                      <span className="text-sm font-extrabold tabular-nums">{formatIQD(lineTotal)}</span>
                    </div>
                    {qty >= maxQty && (
                      <p className="text-[11px] text-muted">هذه أقصى كمية متاحة من هذا المنتج.</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <aside className="card border border-dark-border rounded-2xl p-4 space-y-4 lg:sticky lg:top-4">
            <div>
              <label htmlFor="cart-gov" className="block text-sm font-bold mb-1.5">
                محافظة التوصيل
              </label>
              <GovernorateSelect id="cart-gov" value={gov} onChange={setGov} />
              <p className="text-[11px] text-muted mt-1.5">
                أجرة التوصيل حسب المحافظة، وتقدر تغيرها بصفحة إكمال الطلب.
              </p>
            </div>

            <TotalsRows
              settings={settings}
              governorate={gov}
              subtotal={s.subtotal}
              itemsCount={s.itemsCount}
            />

            <p className="text-[11px] text-muted leading-relaxed">
              الدفع نقدا عند الاستلام. الأسعار تثبت عند إرسال الطلب حسب السعر الحالي.
            </p>

            {!settings.open ? (
              <button type="button" disabled className={`${primaryBtn} w-full`}>
                استقبال الطلبات متوقف مؤقتا
              </button>
            ) : user ? (
              <Link
                href={CHECKOUT_PATH}
                aria-disabled={s.syncing || undefined}
                className={`${primaryBtn} w-full ${s.syncing ? 'pointer-events-none opacity-60' : ''}`}
              >
                إكمال الطلب
                <ArrowLeft className="w-4 h-4" />
              </Link>
            ) : (
              <Link
                href={`/login?next=${encodeURIComponent(CHECKOUT_PATH)}`}
                className={`${primaryBtn} w-full`}
              >
                <LogIn className="w-4 h-4" />
                سجل دخولك وأكمل الطلب
              </Link>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
