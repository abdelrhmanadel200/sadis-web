'use client';

import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Banknote, CheckCircle2, ClipboardCheck, Loader2, RefreshCw, ShoppingCart, Truck } from 'lucide-react';
import StoreShell from '@/components/store/StoreShell';
import { ProductThumb } from '@/components/store/ProductVisuals';
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
  fieldClass,
  primaryBtn,
} from '@/components/store/StoreParts';
import { useCartProducts, useStoreSettings } from '@/components/store/useStoreData';
import { useAuth } from '@/components/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { clearCart } from '@/lib/cart';
import { GOVERNORATES, formatIQD, normalizeIraqPhone } from '@/lib/iraq';
import { STORE_PLACED_KEY, UUID_RE, localIraqPhone, productCover } from '@/lib/store';
import type { PlaceStoreOrderResult, StoreOrder } from '@/lib/types';

// إكمال الطلب يحتاج دخول (StoreShell يحول الزائر إلى /login?next=/store/checkout).
export default function CheckoutPage() {
  return (
    <StoreShell requireAuth>
      <CheckoutView />
    </StoreShell>
  );
}

const TOKEN_KEY = 'sadis_store_checkout_token';

type Field = 'name' | 'phone' | 'alt' | 'gov' | 'area' | 'address' | 'notes';
const FIELD_ORDER: Field[] = ['name', 'phone', 'alt', 'gov', 'area', 'address', 'notes'];

function newUuid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // WebView قديم: نولده يدويا
  }
  const b = new Uint8Array(16);
  try {
    crypto.getRandomValues(b);
  } catch {
    for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  }
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// رمز منع التكرار مربوط بمحتوى السلة: نفس السلة = نفس الرمز،
// فالإرسال المكرر (أو إعادة المحاولة بعد انقطاع) يرجع نفس الطلب.
let memoryToken: { sig: string; token: string } | null = null;

function getClientToken(sig: string): string {
  try {
    const raw = window.sessionStorage.getItem(TOKEN_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as { sig?: unknown; token?: unknown };
      if (saved.sig === sig && typeof saved.token === 'string' && UUID_RE.test(saved.token)) {
        return saved.token;
      }
    }
  } catch {
    // نعتمد على الذاكرة
  }
  if (memoryToken && memoryToken.sig === sig) return memoryToken.token;
  const token = newUuid();
  memoryToken = { sig, token };
  try {
    window.sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ sig, token }));
  } catch {
    // يبقى في الذاكرة
  }
  return token;
}

function dropClientToken() {
  memoryToken = null;
  try {
    window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // لا شيء
  }
}

function friendlyError(message: string | undefined): string {
  const m = message ?? '';
  if (!m) return 'تعذر إرسال الطلب، حاول مرة ثانية.';
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(m)) {
    return 'تعذر الاتصال بالخادم. تأكد من الإنترنت واضغط إرسال مرة ثانية (ما راح يتكرر الطلب).';
  }
  return m;
}

function CheckoutView() {
  const router = useRouter();
  const { user } = useAuth();
  const { settings } = useStoreSettings();
  const s = useCartProducts();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [alt, setAlt] = useState('');
  const [gov, setGov] = useState('');
  const [area, setArea] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState<PlaceStoreOrderResult | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    setGov((v) => v || loadSavedGovernorate());
  }, []);

  // تعبئة الاسم والرقم من الحساب، والعنوان من آخر طلب
  const uid = user?.id;
  const authPhone = user?.phone;
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      try {
        const [profRes, lastRes] = await Promise.all([
          supabase.from('profiles').select('name, phone').eq('id', uid).maybeSingle(),
          supabase
            .from('store_orders')
            .select('customer_name, phone, alt_phone, governorate, area, address')
            .eq('user_id', uid)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        if (cancelled) return;
        const prof = (profRes.data ?? null) as { name: string | null; phone: string | null } | null;
        const last = (lastRes.error ? null : lastRes.data) as Pick<
          StoreOrder,
          'customer_name' | 'phone' | 'alt_phone' | 'governorate' | 'area' | 'address'
        > | null;
        const profPhone = normalizeIraqPhone(prof?.phone) ?? normalizeIraqPhone(authPhone);
        setName((v) => v || prof?.name?.trim() || last?.customer_name || '');
        setPhone((v) => v || localIraqPhone(profPhone ?? last?.phone ?? ''));
        setAlt((v) => v || localIraqPhone(last?.alt_phone ?? ''));
        if (last?.governorate && (GOVERNORATES as readonly string[]).includes(last.governorate)) {
          setGov((v) => v || last.governorate);
        }
        setArea((v) => v || last?.area || '');
        setAddress((v) => v || last?.address || '');
      } catch {
        // التعبئة اختيارية
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, authPhone]);

  const clearError = (f: Field) =>
    setErrors((e) => {
      if (!e[f]) return e;
      const next = { ...e };
      delete next[f];
      return next;
    });

  const validate = (): Partial<Record<Field, string>> => {
    const e: Partial<Record<Field, string>> = {};
    const n = name.trim();
    if (n.length < 2) e.name = 'اكتب الاسم الكامل.';
    else if (n.length > 120) e.name = 'الاسم طويل جدا.';
    if (!normalizeIraqPhone(phone)) e.phone = 'رقم الهاتف غير صحيح، اكتبه مثل 07XXXXXXXXX.';
    if (alt.trim() && !normalizeIraqPhone(alt)) e.alt = 'الرقم الإضافي غير صحيح، اكتبه مثل 07XXXXXXXXX.';
    if (!(GOVERNORATES as readonly string[]).includes(gov)) e.gov = 'اختر المحافظة.';
    const a = area.trim();
    if (a.length < 2) e.area = 'اكتب المنطقة أو الحي.';
    else if (a.length > 120) e.area = 'اسم المنطقة طويل جدا.';
    const ad = address.trim();
    if (ad.length < 3) e.address = 'اكتب أقرب نقطة دالة حتى يوصلك المندوب بسهولة.';
    else if (ad.length > 300) e.address = 'العنوان طويل جدا (300 حرف كحد أقصى).';
    if (notes.trim().length > 500) e.notes = 'الملاحظات طويلة جدا (500 حرف كحد أقصى).';
    return e;
  };

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (submittingRef.current || placed) return;
    setFormError(null);

    const errs = validate();
    setErrors(errs);
    const firstBad = FIELD_ORDER.find((f) => errs[f]);
    if (firstBad) {
      setFormError('راجع الحقول المؤشرة بالأحمر.');
      document.getElementById(`co-${firstBad}`)?.focus();
      return;
    }
    if (!settings.open) {
      setFormError('استقبال الطلبات متوقف مؤقتا.');
      return;
    }
    if (s.syncing || s.lines.length === 0) {
      setFormError('انتظر لحظة حتى تتحدث السلة.');
      return;
    }

    const items = s.lines.map((l) => ({ product_id: l.product.id, qty: l.qty }));
    const sig = items
      .map((i) => `${i.product_id}:${i.qty}`)
      .sort()
      .join('|');
    const token = getClientToken(sig);
    const mainPhone = normalizeIraqPhone(phone);
    const altPhone = alt.trim() ? normalizeIraqPhone(alt) : null;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('place_store_order', {
        p_items: items,
        p_customer_name: name.trim(),
        p_phone: mainPhone,
        p_governorate: gov,
        p_area: area.trim(),
        p_address: address.trim() || null,
        p_notes: notes.trim() || null,
        p_alt_phone: altPhone && altPhone !== mainPhone ? altPhone : null,
        p_client_token: token,
      });
      if (error) {
        setFormError(friendlyError(error.message));
        // الأسعار أو المخزون ربما تغيرت: نحدث السلة
        s.reload();
        return;
      }
      const res = (data ?? null) as PlaceStoreOrderResult | null;
      if (!res || !res.order_no) {
        setFormError('ما وصلنا رد واضح. افتح صفحة طلباتي وتأكد قبل ما تعيد الإرسال.');
        return;
      }
      try {
        window.sessionStorage.setItem(
          STORE_PLACED_KEY,
          JSON.stringify({
            order_no: res.order_no,
            total_iqd: res.total_iqd,
            repeated: !!res.repeated,
          }),
        );
      } catch {
        // صفحة الطلبات تعرض المبلغ من القاعدة
      }
      dropClientToken();
      setPlaced(res);
      clearCart();
      router.replace(`/store/orders?placed=${encodeURIComponent(String(res.order_no))}`);
    } catch (e) {
      setFormError(friendlyError(e instanceof Error ? e.message : ''));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  // بعد نجاح الطلب وقبل الانتقال لصفحة طلباتي
  if (placed) {
    return (
      <div className="px-4 py-10 md:p-8 max-w-xl mx-auto text-center">
        <div className="mx-auto w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center mb-5">
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        </div>
        <h1 className="font-cairo font-extrabold text-2xl mb-2">
          تم إرسال طلبك رقم #{placed.order_no}
        </h1>
        <p className="text-muted mb-1">المبلغ الكلي: {formatIQD(placed.total_iqd)} (نقدا عند الاستلام)</p>
        <p className="text-muted text-sm mb-6">راح نتصل بيك لتأكيد الطلب قبل التوصيل.</p>
        <p className="flex items-center justify-center gap-2 text-sm text-muted mb-3">
          <Loader2 className="w-4 h-4 animate-spin" />
          جاري فتح طلباتي...
        </p>
        <Link href={`/store/orders?placed=${placed.order_no}`} className={primaryBtn}>
          فتح طلباتي
        </Link>
      </div>
    );
  }

  const busy = submitting || s.syncing;

  return (
    <div className="px-4 py-5 md:p-8 max-w-5xl mx-auto pb-16">
      <StoreBackLink href="/store/cart" label="السلة" />
      <StorePageTitle
        icon={<ClipboardCheck className="w-7 h-7 text-primary-light shrink-0" />}
        title="إكمال الطلب"
        subtitle="اكتب معلومات التوصيل، وراح نتصل بيك لتأكيد الطلب قبل ما نرسله."
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

      {s.loading || (s.lines.length === 0 && s.syncing && !s.error) ? (
        <div className="grid lg:grid-cols-5 gap-5 animate-pulse" aria-hidden>
          <div className="lg:col-span-3 h-96 rounded-2xl card border border-dark-border" />
          <div className="lg:col-span-2 h-72 rounded-2xl card border border-dark-border" />
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
          أضف منتجات للسلة أولا، وبعدها ارجع لإكمال الطلب.
        </StoreEmpty>
      ) : (
        <form onSubmit={onSubmit} noValidate className="grid lg:grid-cols-5 gap-5 items-start">
          {/* معلومات التوصيل */}
          <section className="lg:col-span-3 card border border-dark-border rounded-2xl p-4 md:p-5 space-y-4">
            <h2 className="font-cairo font-bold text-lg flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary-light" />
              معلومات التوصيل
            </h2>

            <FormField id="co-name" label="الاسم الكامل" error={errors.name}>
              <input
                id="co-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearError('name');
                }}
                autoComplete="name"
                maxLength={120}
                placeholder="اسم مستلم الطلب"
                aria-invalid={!!errors.name || undefined}
                className={`${fieldClass} ${errors.name ? '!border-red-500' : ''}`}
              />
            </FormField>

            <div className="grid sm:grid-cols-2 gap-4">
              <FormField id="co-phone" label="رقم الهاتف" error={errors.phone}>
                <input
                  id="co-phone"
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    clearError('phone');
                  }}
                  autoComplete="tel"
                  maxLength={20}
                  placeholder="07XXXXXXXXX"
                  aria-invalid={!!errors.phone || undefined}
                  className={`${fieldClass} text-left ${errors.phone ? '!border-red-500' : ''}`}
                />
              </FormField>
              <FormField id="co-alt" label="رقم إضافي (اختياري)" error={errors.alt}>
                <input
                  id="co-alt"
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  value={alt}
                  onChange={(e) => {
                    setAlt(e.target.value);
                    clearError('alt');
                  }}
                  maxLength={20}
                  placeholder="07XXXXXXXXX"
                  aria-invalid={!!errors.alt || undefined}
                  className={`${fieldClass} text-left ${errors.alt ? '!border-red-500' : ''}`}
                />
              </FormField>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <FormField id="co-gov" label="المحافظة" error={errors.gov}>
                <GovernorateSelect
                  id="co-gov"
                  value={gov}
                  onChange={(v) => {
                    setGov(v);
                    clearError('gov');
                  }}
                  invalid={!!errors.gov}
                />
              </FormField>
              <FormField id="co-area" label="المنطقة" error={errors.area}>
                <input
                  id="co-area"
                  value={area}
                  onChange={(e) => {
                    setArea(e.target.value);
                    clearError('area');
                  }}
                  maxLength={120}
                  placeholder="القضاء أو الحي"
                  aria-invalid={!!errors.area || undefined}
                  className={`${fieldClass} ${errors.area ? '!border-red-500' : ''}`}
                />
              </FormField>
            </div>

            <FormField id="co-address" label="أقرب نقطة دالة / العنوان" error={errors.address}>
              <input
                id="co-address"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  clearError('address');
                }}
                autoComplete="street-address"
                maxLength={300}
                placeholder="مثلا: قرب جامع ... أو مدرسة ..."
                aria-invalid={!!errors.address || undefined}
                className={`${fieldClass} ${errors.address ? '!border-red-500' : ''}`}
              />
            </FormField>

            <FormField
              id="co-notes"
              label="ملاحظات (اختياري)"
              error={errors.notes}
              hint={`${notes.length.toLocaleString('ar-IQ')} / ٥٠٠`}
            >
              <textarea
                id="co-notes"
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  clearError('notes');
                }}
                rows={3}
                maxLength={500}
                placeholder="وقت مناسب للاتصال أو أي تفاصيل تساعد المندوب"
                aria-invalid={!!errors.notes || undefined}
                className={`${fieldClass} resize-y ${errors.notes ? '!border-red-500' : ''}`}
              />
            </FormField>
          </section>

          {/* ملخص الطلب */}
          <aside className="lg:col-span-2 card border border-dark-border rounded-2xl p-4 md:p-5 space-y-4 lg:sticky lg:top-4">
            <h2 className="font-cairo font-bold text-lg">ملخص الطلب</h2>
            <ul className="space-y-2.5 max-h-72 overflow-y-auto pe-1">
              {s.lines.map(({ product, qty, lineTotal }) => (
                <li key={product.id} className="flex items-center gap-3">
                  <span className="w-12 h-12 rounded-lg overflow-hidden border border-dark-border shrink-0">
                    <ProductThumb
                      src={productCover(product)}
                      alt=""
                      category={product.category}
                      iconClassName="w-5 h-5 text-primary-light/70"
                    />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold line-clamp-1">{product.title}</span>
                    <span className="block text-xs text-muted tabular-nums">
                      {qty.toLocaleString('ar-IQ')} × {formatIQD(product.price_iqd)}
                    </span>
                  </span>
                  <span className="text-sm font-bold tabular-nums shrink-0">{formatIQD(lineTotal)}</span>
                </li>
              ))}
            </ul>
            <Link href="/store/cart" className="inline-block text-xs text-primary-light font-bold hover:underline">
              تعديل السلة
            </Link>

            <TotalsRows
              settings={settings}
              governorate={gov}
              subtotal={s.subtotal}
              itemsCount={s.itemsCount}
            />

            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 flex items-start gap-2.5 text-sm">
              <Banknote className="w-5 h-5 text-emerald-600 dark:text-emerald-300 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <p className="font-bold">الدفع نقدا عند الاستلام</p>
                <p className="text-muted text-xs mt-0.5">
                  تدفع للمندوب لما يوصلك الطلب، وتقدر تفحصه قبل الدفع. المبلغ النهائي يظهر بعد الإرسال حسب الأسعار الحالية.
                </p>
              </div>
            </div>

            {formError && (
              <StoreNotice tone="error">
                <p>{formError}</p>
              </StoreNotice>
            )}

            <button type="submit" disabled={busy || !settings.open} className={`${primaryBtn} w-full py-3.5 text-base`}>
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  جاري إرسال الطلب...
                </>
              ) : (
                'تأكيد الطلب'
              )}
            </button>
            <p className="text-[11px] text-muted text-center leading-relaxed">
              بتأكيد الطلب توافق على{' '}
              <Link href="/terms" className="underline">
                شروط الخدمة
              </Link>{' '}
              و
              <Link href="/refund" className="underline">
                سياسة الاسترجاع
              </Link>
              .
            </p>
          </aside>
        </form>
      )}
    </div>
  );
}

function FormField({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <label htmlFor={id} className="block text-sm font-bold">
          {label}
        </label>
        {hint && <span className="text-[11px] text-muted tabular-nums">{hint}</span>}
      </div>
      {children}
      {error && (
        <p role="alert" className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
