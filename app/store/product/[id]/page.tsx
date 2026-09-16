'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Banknote,
  Check,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  PackageX,
  RefreshCw,
  ShoppingCart,
  Truck,
  Zap,
} from 'lucide-react';
import StoreShell from '@/components/store/StoreShell';
import QtyStepper from '@/components/store/QtyStepper';
import { CartButton } from '@/components/store/CartButton';
import { Price, ProductThumb } from '@/components/store/ProductVisuals';
import {
  StoreBackLink,
  StoreClosedNotice,
  StoreEmpty,
  StoreNotice,
  ghostBtn,
  primaryBtn,
} from '@/components/store/StoreParts';
import { useStoreSettings } from '@/components/store/useStoreData';
import { supabase } from '@/lib/supabase';
import { addToCart, cartQtyOf, useCart, useCartReady } from '@/lib/cart';
import { formatIQD, waLink } from '@/lib/iraq';
import { getSubjectById } from '@/lib/subjects';
import {
  PRODUCT_COLUMNS,
  UUID_RE,
  discountPercent,
  hasDiscount,
  isSellable,
  lastPiecesLabel,
  productImages,
  productMaxQty,
  storeCategoryLabel,
  type StoreProduct,
} from '@/lib/store';

// صفحة المنتج عامة مثل المتجر (بدون دخول أو اشتراك).
export default function ProductDetailPage() {
  return (
    <StoreShell>
      <ProductDetail />
    </StoreShell>
  );
}

function ProductDetail() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id ?? '').toLowerCase();
  const router = useRouter();
  const { settings } = useStoreSettings();
  const cart = useCart();
  const cartReady = useCartReady();

  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [active, setActive] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [pageUrl, setPageUrl] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    setPageUrl(window.location.href);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      if (!UUID_RE.test(id)) {
        setProduct(null);
        setLoading(false);
        return;
      }
      const { data, error: err } = await supabase
        .from('products')
        .select(PRODUCT_COLUMNS)
        .eq('id', id)
        .eq('type', 'physical')
        .maybeSingle();
      if (cancelled) return;
      if (err) {
        setError(err.message || 'تعذر تحميل المنتج');
        setProduct(null);
      } else {
        const p = (data ?? null) as unknown as StoreProduct | null;
        setProduct(p && isSellable(p) ? p : null);
        setActive(0);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, tick]);

  const maxQty = product ? productMaxQty(product) : 0;
  const inCart = product && cartReady ? cartQtyOf(cart, product.id) : 0;
  const room = Math.max(0, maxQty - inCart);
  const stepperMax = Math.max(1, room);

  // الكمية لا تتجاوز المتاح بعد ما في السلة
  useEffect(() => {
    setQty((q) => Math.min(Math.max(1, q), stepperMax));
  }, [stepperMax]);

  if (loading) {
    return (
      <div className="px-4 py-5 md:p-8 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-6 animate-pulse" aria-hidden>
          <div className="aspect-square rounded-2xl bg-primary/10" />
          <div className="space-y-3">
            <div className="h-7 rounded bg-primary/10 w-3/4" />
            <div className="h-4 rounded bg-primary/10 w-1/3" />
            <div className="h-24 rounded-2xl bg-primary/10" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-5 md:p-8 max-w-5xl mx-auto">
        <StoreBackLink href="/store" label="المتجر" />
        <StoreNotice tone="error" title="تعذر تحميل المنتج">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setTick((t) => t + 1)}
            className="mt-2 inline-flex items-center gap-1.5 font-bold underline"
          >
            <RefreshCw className="w-4 h-4" />
            إعادة المحاولة
          </button>
        </StoreNotice>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="px-4 py-5 md:p-8 max-w-5xl mx-auto">
        <StoreBackLink href="/store" label="المتجر" />
        <StoreEmpty
          icon={<PackageX className="w-8 h-8" />}
          title="المنتج غير متوفر"
          action={
            <Link href="/store" className={primaryBtn}>
              تصفح المتجر
            </Link>
          }
        >
          ممكن انحذف أو صار غير متاح حاليا.
        </StoreEmpty>
      </div>
    );
  }

  const images = productImages(product);
  const current = images[Math.min(active, Math.max(0, images.length - 1))] ?? null;
  const soldOut = maxQty === 0;
  const storeOpen = settings.open;
  const canBuy = storeOpen && !soldOut;
  const subject = getSubjectById(product.subject_id);

  const go = (dir: 1 | -1) => {
    if (images.length < 2) return;
    setActive((i) => (i + dir + images.length) % images.length);
  };

  const onAdd = () => {
    if (!canBuy || room === 0) return;
    addToCart(product.id, qty, maxQty);
    setQty(1);
    setAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 2000);
  };

  const onBuyNow = () => {
    if (!canBuy) return;
    if (room > 0) addToCart(product.id, qty, maxQty);
    router.push('/store/checkout');
  };

  let stockBadge: { text: string; cls: string };
  if (soldOut) {
    stockBadge = { text: 'نفد', cls: 'bg-red-500/15 text-red-700 dark:text-red-300' };
  } else if (product.stock !== null && product.stock <= 5) {
    stockBadge = {
      text: lastPiecesLabel(product.stock),
      cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    };
  } else {
    stockBadge = { text: 'متوفر', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' };
  }

  return (
    <div className="px-4 py-5 md:p-8 max-w-5xl mx-auto pb-16">
      <div className="flex items-center justify-between gap-2 mb-1">
        <StoreBackLink href="/store" label="المتجر" />
        <div className="mb-4">
          <CartButton />
        </div>
      </div>

      {!storeOpen && <StoreClosedNotice className="mb-4" />}

      <div className="grid md:grid-cols-2 gap-6">
        {/* الصور */}
        <div>
          <div
            className="relative aspect-square rounded-2xl overflow-hidden border border-dark-border card"
            onTouchStart={(e) => {
              touchX.current = e.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(e) => {
              const start = touchX.current;
              touchX.current = null;
              const end = e.changedTouches[0]?.clientX;
              if (start === null || end === undefined) return;
              const dx = end - start;
              // في RTL السحب لليمين يعرض الصورة التالية
              if (Math.abs(dx) > 40) go(dx > 0 ? 1 : -1);
            }}
          >
            <ProductThumb
              src={current}
              alt={product.title}
              category={product.category}
              fit="contain"
              iconClassName="w-20 h-20 text-primary-light/70"
            />
            {hasDiscount(product) && (
              <span className="absolute top-3 start-3 text-xs font-bold bg-emerald-600 text-white px-2.5 py-1 rounded-full">
                خصم {discountPercent(product).toLocaleString('ar-IQ')}٪
              </span>
            )}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label="الصورة السابقة"
                  className="absolute top-1/2 -translate-y-1/2 start-2 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label="الصورة التالية"
                  className="absolute top-1/2 -translate-y-1/2 end-2 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] bg-black/60 text-white px-2 py-0.5 rounded-full tabular-nums">
                  {(active + 1).toLocaleString('ar-IQ')} / {images.length.toLocaleString('ar-IQ')}
                </span>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
              {images.map((src, i) => (
                <button
                  key={`${src}-${i}`}
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`الصورة ${i + 1}`}
                  aria-current={i === active}
                  className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition ${
                    i === active ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <ProductThumb src={src} alt="" category={product.category} iconClassName="w-5 h-5" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* التفاصيل */}
        <div className="space-y-4 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Link
              href={`/store?cat=${product.category}`}
              className="bg-primary/15 text-primary-light px-3 py-1 rounded-full font-semibold hover:opacity-80"
            >
              {storeCategoryLabel(product.category)}
            </Link>
            {subject && (
              <span className="border border-dark-border px-3 py-1 rounded-full text-muted">
                {subject.name_ar}
              </span>
            )}
            <span className={`px-3 py-1 rounded-full font-bold ${stockBadge.cls}`}>{stockBadge.text}</span>
          </div>

          <div>
            <h1 className="font-cairo font-extrabold text-2xl md:text-3xl leading-snug break-words">
              {product.title}
            </h1>
            {product.teacher_name && <p className="text-muted mt-1">{product.teacher_name}</p>}
          </div>

          <div className="card border border-dark-border rounded-2xl p-4 space-y-4">
            <Price price={product.price_iqd} compareAt={product.compare_at_price_iqd} size="lg" />

            {soldOut ? (
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                نفد هذا المنتج حاليا، ارجع له قريبا.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-muted">الكمية</span>
                <QtyStepper
                  value={qty}
                  onChange={setQty}
                  max={stepperMax}
                  disabled={!canBuy || room === 0}
                />
                {room > 0 && qty >= room && (
                  <span className="text-xs text-muted">هذه أقصى كمية تقدر تضيفها</span>
                )}
              </div>
            )}

            {inCart > 0 && (
              <p className="text-xs text-muted">
                في سلتك {inCart.toLocaleString('ar-IQ')} من هذا المنتج.{' '}
                <Link href="/store/cart" className="text-primary-light font-bold hover:underline">
                  عرض السلة
                </Link>
                {room === 0 && ' وصلت لأقصى كمية مسموحة.'}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onAdd}
                disabled={!canBuy || room === 0}
                className={
                  added
                    ? 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold bg-emerald-600 text-white'
                    : `${ghostBtn} px-4`
                }
              >
                {added ? <Check className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
                {added ? 'أضيف للسلة' : 'أضف للسلة'}
              </button>
              <button
                type="button"
                onClick={onBuyNow}
                disabled={!canBuy || (room === 0 && inCart === 0)}
                className={`${primaryBtn} px-4`}
              >
                <Zap className="w-4 h-4" />
                اطلب الآن
              </button>
            </div>

            {settings.whatsapp && (
              <a
                href={waLink(
                  settings.whatsapp,
                  `مرحبا، عندي استفسار عن: ${product.title}${pageUrl ? `\n${pageUrl}` : ''}`,
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold border border-emerald-500/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 transition"
              >
                <MessageCircle className="w-4 h-4" />
                اسأل على واتساب
              </a>
            )}
          </div>

          <ul className="text-sm space-y-2">
            <li className="flex items-start gap-2">
              <Truck className="w-4 h-4 mt-0.5 text-primary-light shrink-0" />
              <span className="text-muted">
                توصيل لكل المحافظات، وأجرة التوصيل حسب المحافظة وتظهر قبل تأكيد الطلب.
                {settings.loaded && settings.freeMin > 0 && (
                  <> التوصيل مجاني للطلب من {formatIQD(settings.freeMin)}.</>
                )}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Banknote className="w-4 h-4 mt-0.5 text-primary-light shrink-0" />
              <span className="text-muted">الدفع نقدا عند الاستلام، وتقدر تفحص الطلب قبل ما تدفع.</span>
            </li>
          </ul>

          {product.description && (
            <div>
              <h2 className="font-cairo font-bold text-lg mb-2">الوصف</h2>
              <p className="leading-relaxed whitespace-pre-line break-words">{product.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
