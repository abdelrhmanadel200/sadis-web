'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Banknote,
  ChevronLeft,
  KeyRound,
  ReceiptText,
  RefreshCw,
  Search,
  SearchX,
  ShoppingBag,
  Truck,
  X,
} from 'lucide-react';
import StoreShell from '@/components/store/StoreShell';
import ProductCard from '@/components/store/ProductCard';
import { CartButton, CartFab } from '@/components/store/CartButton';
import {
  StoreClosedNotice,
  StoreEmpty,
  StoreNotice,
  StorePageTitle,
  ghostBtn,
} from '@/components/store/StoreParts';
import { useStoreSettings } from '@/components/store/useStoreData';
import { supabase } from '@/lib/supabase';
import { formatIQD } from '@/lib/iraq';
import { DEFAULT_SUBJECTS } from '@/lib/subjects';
import {
  PRODUCT_COLUMNS,
  STORE_CATEGORIES,
  STORE_CATEGORY_IDS,
  SUBJECT_CATEGORIES,
  isStoreCategory,
  normalizeSearch,
  storeCategoryLabel,
  type StoreProduct,
} from '@/lib/store';
import type { StoreCategory } from '@/lib/types';

type CategoryFilter = 'all' | StoreCategory;

// المتجر عام: التصفح بدون دخول وبدون اشتراك، والدخول يطلب عند إكمال الطلب فقط.
export default function StorePage() {
  return (
    <StoreShell>
      <StoreCatalog />
    </StoreShell>
  );
}

function StoreCatalog() {
  const { settings } = useStoreSettings();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [subject, setSubject] = useState('all');
  const [search, setSearch] = useState('');

  // فتح فرع مباشرة من رابط مثل /store?cat=booklets
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get('cat');
    if (isStoreCategory(c)) setCategory(c);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      // RLS تخفي المنتجات غير النشطة
      const { data, error: err } = await supabase
        .from('products')
        .select(PRODUCT_COLUMNS)
        .eq('type', 'physical')
        .in('category', STORE_CATEGORY_IDS)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(500);
      if (cancelled) return;
      if (err) {
        setError(err.message || 'تعذر تحميل المنتجات');
      } else {
        setProducts((data ?? []) as unknown as StoreProduct[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: products.length };
    for (const p of products) m[p.category] = (m[p.category] ?? 0) + 1;
    return m;
  }, [products]);

  const inCategory = useMemo(
    () => (category === 'all' ? products : products.filter((p) => p.category === category)),
    [products, category],
  );

  const showSubjects = category !== 'all' && SUBJECT_CATEGORIES.includes(category);

  // المواد التي فيها منتجات في هذا الفرع فقط
  const subjectOptions = useMemo(() => {
    if (!showSubjects) return [];
    const used = new Map<string, number>();
    for (const p of inCategory) {
      if (p.subject_id) used.set(p.subject_id, (used.get(p.subject_id) ?? 0) + 1);
    }
    return DEFAULT_SUBJECTS.filter((s) => used.has(s.id)).map((s) => ({
      id: s.id,
      label: s.name_ar,
      count: used.get(s.id) ?? 0,
    }));
  }, [showSubjects, inCategory]);

  const visible = useMemo(() => {
    const q = normalizeSearch(search);
    return inCategory.filter((p) => {
      if (showSubjects && subject !== 'all' && p.subject_id !== subject) return false;
      if (!q) return true;
      const subjectName = DEFAULT_SUBJECTS.find((s) => s.id === p.subject_id)?.name_ar ?? '';
      const hay = normalizeSearch(
        `${p.title} ${p.teacher_name ?? ''} ${p.description ?? ''} ${subjectName} ${storeCategoryLabel(p.category)}`,
      );
      return hay.includes(q);
    });
  }, [inCategory, showSubjects, subject, search]);

  const chooseCategory = (c: CategoryFilter) => {
    setCategory(c);
    setSubject('all');
  };

  const resetFilters = () => {
    setSearch('');
    setSubject('all');
    setCategory('all');
  };

  const storeOpen = settings.open;

  return (
    <div className="px-4 py-5 md:p-8 max-w-6xl mx-auto pb-28">
      <StorePageTitle
        icon={<ShoppingBag className="w-7 h-7 text-primary-light shrink-0" />}
        title="متجر المستلزمات"
        subtitle="كتب وملازم وقرطاسية ودفاتر للسادس الإعدادي، توصيل لكل المحافظات والدفع نقدا عند الاستلام."
        actions={
          <>
            <CartButton />
            <Link
              href="/store/orders"
              className="inline-flex items-center gap-2 rounded-xl border border-dark-border card px-3.5 py-2 text-sm font-semibold hover:border-primary/50 transition"
            >
              <ReceiptText className="w-4 h-4" />
              طلباتي
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary-light px-3 py-1 font-semibold">
          <Truck className="w-3.5 h-3.5" />
          توصيل لكل المحافظات
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary-light px-3 py-1 font-semibold">
          <Banknote className="w-3.5 h-3.5" />
          الدفع عند الاستلام
        </span>
        {settings.loaded && settings.freeMin > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-3 py-1 font-semibold">
            توصيل مجاني للطلب من {formatIQD(settings.freeMin)}
          </span>
        )}
      </div>

      {!storeOpen && <StoreClosedNotice className="mb-4" />}

      {/* أكواد التفعيل: المتجر يشمل الاشتراك أيضا */}
      <Link
        href="/account/subscription"
        className="mb-5 flex items-center gap-3 rounded-2xl border border-primary/40 bg-gradient-to-l from-primary/15 to-primary/5 p-4 hover:border-primary/70 transition"
      >
        <span className="w-11 h-11 rounded-xl bg-primary/20 text-primary-light flex items-center justify-center shrink-0">
          <KeyRound className="w-5 h-5" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-cairo font-bold">أكواد تفعيل المنصة</span>
          <span className="block text-xs text-muted leading-relaxed mt-0.5">
            فعل الأقسام والأستاذ ذكي بكود، أو اطلب كود التفعيل يوصلك لعنوانك.
          </span>
        </span>
        <ChevronLeft className="w-5 h-5 text-primary-light shrink-0" />
      </Link>

      {/* الفروع */}
      <div className="-mx-4 px-4 md:mx-0 md:px-0 mb-3 flex gap-2 overflow-x-auto no-scrollbar md:flex-wrap">
        {[{ id: 'all' as const, label: 'الكل' }, ...STORE_CATEGORIES].map((c) => {
          const active = category === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => chooseCategory(c.id)}
              aria-pressed={active}
              className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold border transition ${
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'card border-dark-border text-muted hover:border-primary/40'
              }`}
            >
              {c.label}
              {!loading && (
                <span className="text-xs opacity-70"> ({(counts[c.id] ?? 0).toLocaleString('ar-IQ')})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* البحث */}
      <div className="relative mb-3 md:max-w-md">
        <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-muted pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث عن كتاب، ملزمة، أستاذ..."
          aria-label="بحث في المتجر"
          className="input-field w-full rounded-xl ps-9 pe-9 py-2.5 text-base md:text-sm outline-none focus:border-primary"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label="مسح البحث"
            className="absolute top-1/2 -translate-y-1/2 end-2 p-1 rounded-lg text-muted hover-surface"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* المادة (للكتب والملازم) */}
      {showSubjects && subjectOptions.length > 0 && (
        <div className="-mx-4 px-4 md:mx-0 md:px-0 mb-4 flex gap-1.5 overflow-x-auto no-scrollbar md:flex-wrap">
          <SubjectChip label="كل المواد" active={subject === 'all'} onClick={() => setSubject('all')} />
          {subjectOptions.map((s) => (
            <SubjectChip
              key={s.id}
              label={`${s.label} (${s.count.toLocaleString('ar-IQ')})`}
              active={subject === s.id}
              onClick={() => setSubject(s.id)}
            />
          ))}
        </div>
      )}

      <div className="mt-4">
        {loading ? (
          <GridSkeleton />
        ) : error ? (
          <StoreNotice tone="error" title="تعذر تحميل المنتجات">
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
        ) : products.length === 0 ? (
          <StoreEmpty icon={<ShoppingBag className="w-8 h-8" />} title="المنتجات تضاف قريبا">
            نجهز الكتب والملازم والقرطاسية والدفاتر، ارجع لنا قريبا.
          </StoreEmpty>
        ) : visible.length === 0 ? (
          <StoreEmpty
            icon={<SearchX className="w-8 h-8" />}
            title="ما لقينا منتجات هنا"
            action={
              <button type="button" onClick={resetFilters} className={ghostBtn}>
                عرض كل المنتجات
              </button>
            }
          >
            {search ? 'جرب كلمة ثانية أو غير الفرع.' : 'ماكو منتجات في هذا الفرع حاليا.'}
          </StoreEmpty>
        ) : (
          <>
            <p className="text-xs text-muted mb-3">
              {visible.length.toLocaleString('ar-IQ')} منتج
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {visible.map((p) => (
                <ProductCard key={p.id} product={p} storeOpen={storeOpen} />
              ))}
            </div>
          </>
        )}
      </div>

      <CartFab />
    </div>
  );
}

function SubjectChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'border-dark-border text-muted hover:border-primary/40'
      }`}
    >
      {label}
    </button>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4" aria-hidden>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="card border border-dark-border rounded-2xl overflow-hidden animate-pulse">
          <div className="aspect-[4/5] bg-primary/10" />
          <div className="p-3 space-y-2">
            <div className="h-3.5 rounded bg-primary/10 w-4/5" />
            <div className="h-3 rounded bg-primary/10 w-1/2" />
            <div className="h-8 rounded-xl bg-primary/10 mt-3" />
          </div>
        </div>
      ))}
    </div>
  );
}
