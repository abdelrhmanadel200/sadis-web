'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Banknote,
  Check,
  ClipboardList,
  MapPin,
  MessageCircle,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  Truck,
  XCircle,
} from 'lucide-react';
import StoreShell from '@/components/store/StoreShell';
import { CartButton } from '@/components/store/CartButton';
import { ProductThumb } from '@/components/store/ProductVisuals';
import {
  StoreEmpty,
  StoreNotice,
  StorePageTitle,
  fieldClass,
  ghostBtn,
  primaryBtn,
} from '@/components/store/StoreParts';
import { useStoreSettings } from '@/components/store/useStoreData';
import { useAuth } from '@/components/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { formatIQD, waLink } from '@/lib/iraq';
import {
  ORDER_STATUS,
  ORDER_STEPS,
  STORE_PLACED_KEY,
  formatOrderDate,
  localIraqPhone,
  piecesLabel,
} from '@/lib/store';
import type { StoreOrder, StoreOrderItem } from '@/lib/types';

// طلباتي: يحتاج دخول.
export default function StoreOrdersPage() {
  return (
    <StoreShell requireAuth>
      <OrdersView />
    </StoreShell>
  );
}

// أعمدة يراها الطالب فقط
const ORDER_COLUMNS =
  'id,order_no,status,items_count,subtotal_iqd,delivery_fee_iqd,total_iqd,customer_name,phone,alt_phone,governorate,area,address,notes,payment_method,cancel_reason,cancelled_by,confirmed_at,shipped_at,delivered_at,cancelled_at,created_at,updated_at,' +
  'store_order_items(id,product_id,title,image_url,category,unit_price_iqd,qty,line_total_iqd)';

type OrderItemRow = Pick<
  StoreOrderItem,
  'id' | 'product_id' | 'title' | 'image_url' | 'category' | 'unit_price_iqd' | 'qty' | 'line_total_iqd'
>;
type OrderRow = Omit<StoreOrder, 'user_id' | 'client_token' | 'store_order_items'> & {
  store_order_items: OrderItemRow[] | null;
};

interface PlacedInfo {
  order_no: number;
  total_iqd?: number;
  repeated?: boolean;
}

const STATUS_HINT: Record<string, string> = {
  new: 'استلمنا طلبك، وراح نتصل بيك على رقمك لتأكيده.',
  confirmed: 'تأكد طلبك ونجهزه للتوصيل.',
  shipped: 'طلبك ويا المندوب بالطريق إليك، جهز المبلغ نقدا.',
  delivered: 'تم تسليم الطلب، شكرا لطلبك.',
};

function OrdersView() {
  const router = useRouter();
  const { user } = useAuth();
  const uid = user?.id;
  const { settings } = useStoreSettings();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<PlacedInfo | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!uid) return;
      if (!silent) setLoading(true);
      // الفلتر على user_id ضروري: المشرف يقرأ كل الطلبات عبر RLS
      const { data, error: err } = await supabase
        .from('store_orders')
        .select(ORDER_COLUMNS)
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(50);
      if (err) {
        if (!silent) setError(err.message || 'تعذر تحميل الطلبات');
      } else {
        setOrders((data ?? []) as unknown as OrderRow[]);
        setError(null);
      }
      setLoading(false);
    },
    [uid],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // تحديث الحالة عند الرجوع للصفحة
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  // ?placed=رقم الطلب بعد إكمال الطلب (نقرأه من window لتجنب Suspense)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('placed');
    if (!p || !/^\d{1,15}$/.test(p)) return;
    const info: PlacedInfo = { order_no: Number(p) };
    try {
      const raw = window.sessionStorage.getItem(STORE_PLACED_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { order_no?: unknown; total_iqd?: unknown; repeated?: unknown };
        if (String(saved.order_no) === p) {
          if (typeof saved.total_iqd === 'number') info.total_iqd = saved.total_iqd;
          info.repeated = saved.repeated === true;
        }
      }
    } catch {
      // المبلغ يؤخذ من الطلب نفسه
    }
    setPlaced(info);
  }, []);

  const closePlaced = () => {
    setPlaced(null);
    try {
      window.sessionStorage.removeItem(STORE_PLACED_KEY);
    } catch {
      // لا شيء
    }
    router.replace('/store/orders', { scroll: false });
  };

  const placedOrder = placed ? orders.find((o) => o.order_no === placed.order_no) : undefined;
  const placedTotal = placed?.total_iqd ?? placedOrder?.total_iqd;

  return (
    <div className="px-4 py-5 md:p-8 max-w-3xl mx-auto pb-16">
      <StorePageTitle
        icon={<ReceiptText className="w-7 h-7 text-primary-light shrink-0" />}
        title="طلباتي"
        subtitle="طلبات متجر المستلزمات وحالة كل طلب."
        actions={
          <>
            <Link
              href="/store"
              className="inline-flex items-center gap-2 rounded-xl border border-dark-border card px-3.5 py-2 text-sm font-semibold hover:border-primary/50 transition"
            >
              <ShoppingBag className="w-4 h-4" />
              المتجر
            </Link>
            <CartButton />
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              aria-label="تحديث الطلبات"
              className="inline-flex items-center gap-2 rounded-xl border border-dark-border card px-3 py-2 text-sm hover:border-primary/50 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </>
        }
      />

      {placed && (
        <StoreNotice
          tone="success"
          icon={<Check className="w-5 h-5" />}
          title={
            placed.repeated
              ? `طلبك رقم #${placed.order_no} مسجل عندنا`
              : `تم استلام طلبك رقم #${placed.order_no}`
          }
          onClose={closePlaced}
          className="mb-4"
        >
          {placedTotal !== undefined && (
            <p>
              المبلغ الكلي: <span className="font-bold">{formatIQD(placedTotal)}</span> نقدا عند الاستلام.
            </p>
          )}
          <p>راح نتصل بيك على رقمك لتأكيد الطلب قبل التوصيل.</p>
        </StoreNotice>
      )}

      {flash && (
        <StoreNotice tone="info" onClose={() => setFlash(null)} className="mb-4">
          {flash}
        </StoreNotice>
      )}

      {loading && orders.length === 0 ? (
        <div className="space-y-3 animate-pulse" aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className="h-56 rounded-2xl card border border-dark-border" />
          ))}
        </div>
      ) : error ? (
        <StoreNotice tone="error" title="تعذر تحميل الطلبات">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 inline-flex items-center gap-1.5 font-bold underline"
          >
            <RefreshCw className="w-4 h-4" />
            إعادة المحاولة
          </button>
        </StoreNotice>
      ) : orders.length === 0 ? (
        <StoreEmpty
          icon={<ReceiptText className="w-8 h-8" />}
          title="ما عندك طلبات بعد"
          action={
            <Link href="/store" className={primaryBtn}>
              تصفح المتجر
            </Link>
          }
        >
          اطلب الكتب والملازم والقرطاسية، ويوصلك الطلب لباب البيت والدفع عند الاستلام.
        </StoreEmpty>
      ) : (
        <ul className="space-y-4">
          {orders.map((o) => (
            <li key={o.id}>
              <OrderCard
                order={o}
                whatsapp={settings.whatsapp}
                highlight={placed?.order_no === o.order_no}
                onCancelled={() => {
                  setFlash(`تم إلغاء الطلب رقم #${o.order_no}.`);
                  void load(true);
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OrderCard({
  order,
  whatsapp,
  highlight,
  onCancelled,
}: {
  order: OrderRow;
  whatsapp: string;
  highlight: boolean;
  onCancelled: () => void;
}) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const status = ORDER_STATUS[order.status] ?? ORDER_STATUS.new;
  const items = order.store_order_items ?? [];
  const itemsCount = order.items_count || items.reduce((s, i) => s + i.qty, 0);

  const doCancel = async () => {
    if (busy) return;
    setBusy(true);
    setCancelError(null);
    const { error } = await supabase.rpc('cancel_my_store_order', {
      p_order_id: order.id,
      p_reason: reason.trim() ? reason.trim().slice(0, 300) : null,
    });
    setBusy(false);
    if (error) {
      setCancelError(error.message || 'تعذر إلغاء الطلب، حاول مرة ثانية.');
      return;
    }
    setCancelOpen(false);
    setReason('');
    onCancelled();
  };

  return (
    <article
      className={`card border rounded-2xl p-4 md:p-5 space-y-4 ${
        highlight ? 'border-emerald-500/60 ring-2 ring-emerald-500/30' : 'border-dark-border'
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-cairo font-extrabold text-lg tabular-nums">طلب #{order.order_no}</h2>
          <p className="text-xs text-muted mt-0.5">
            {formatOrderDate(order.created_at)} · {piecesLabel(itemsCount)}
          </p>
        </div>
        <span className={`shrink-0 text-xs font-bold px-3 py-1 rounded-full border ${status.badge}`}>
          {status.label}
        </span>
      </header>

      {order.status === 'cancelled' ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300 space-y-0.5">
          <p className="font-bold flex items-center gap-1.5">
            <XCircle className="w-4 h-4" />
            الطلب ملغى
          </p>
          <p className="text-xs">
            {order.cancelled_by === 'admin' ? 'ألغاه فريق المتجر' : 'ألغيته أنت'}
            {order.cancelled_at ? ` · ${formatOrderDate(order.cancelled_at)}` : ''}
          </p>
          {order.cancel_reason && <p className="text-xs">السبب: {order.cancel_reason}</p>}
        </div>
      ) : (
        <>
          <StatusStepper order={order} />
          {STATUS_HINT[order.status] && (
            <p className="text-sm text-muted">{STATUS_HINT[order.status]}</p>
          )}
        </>
      )}

      {/* المنتجات */}
      <ul className="divide-y divide-black/5 dark:divide-white/5">
        {items.map((it) => {
          const thumb = (
            <span className="w-12 h-12 rounded-lg overflow-hidden border border-dark-border shrink-0 block">
              <ProductThumb
                src={it.image_url}
                alt=""
                category={it.category}
                iconClassName="w-5 h-5 text-primary-light/70"
              />
            </span>
          );
          return (
            <li key={it.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              {it.product_id ? <Link href={`/store/product/${it.product_id}`}>{thumb}</Link> : thumb}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold line-clamp-2">{it.title}</p>
                <p className="text-xs text-muted tabular-nums">
                  {it.qty.toLocaleString('ar-IQ')} × {formatIQD(it.unit_price_iqd)}
                </p>
              </div>
              <span className="text-sm font-bold tabular-nums shrink-0">{formatIQD(it.line_total_iqd)}</span>
            </li>
          );
        })}
      </ul>

      {/* المبالغ */}
      <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-3 space-y-1.5 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-muted">المجموع</span>
          <span className="tabular-nums">{formatIQD(order.subtotal_iqd)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted">أجرة التوصيل</span>
          <span className="tabular-nums">
            {order.delivery_fee_iqd === 0 ? 'مجاني' : formatIQD(order.delivery_fee_iqd)}
          </span>
        </div>
        <div className="flex justify-between gap-3 border-t border-dark-border pt-1.5 font-extrabold text-base">
          <span>المبلغ الكلي</span>
          <span className="tabular-nums">{formatIQD(order.total_iqd)}</span>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted pt-0.5">
          <Banknote className="w-3.5 h-3.5" />
          الدفع نقدا عند الاستلام
        </p>
      </div>

      {/* العنوان */}
      <div className="text-sm space-y-1">
        <p className="flex items-start gap-2">
          <MapPin className="w-4 h-4 mt-0.5 text-primary-light shrink-0" />
          <span className="min-w-0 break-words">
            {[order.governorate, order.area, order.address].filter(Boolean).join(' - ')}
          </span>
        </p>
        <p className="text-muted text-xs ps-6">
          {order.customer_name} ·{' '}
          <span dir="ltr" className="tabular-nums">
            {localIraqPhone(order.phone)}
          </span>
          {order.alt_phone && (
            <>
              {' '}·{' '}
              <span dir="ltr" className="tabular-nums">
                {localIraqPhone(order.alt_phone)}
              </span>
            </>
          )}
        </p>
        {order.notes && <p className="text-muted text-xs ps-6 break-words">ملاحظات: {order.notes}</p>}
      </div>

      {/* الإجراءات */}
      {(whatsapp || order.status === 'new') && (
        <div className="flex flex-wrap gap-2 pt-1">
          {whatsapp && (
            <a
              href={waLink(
                whatsapp,
                `مرحبا، عندي استفسار بخصوص طلبي رقم #${order.order_no} من متجر سادس ألترا.`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold border border-emerald-500/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 transition"
            >
              <MessageCircle className="w-4 h-4" />
              تواصل بخصوص الطلب
            </a>
          )}
          {order.status === 'new' && !cancelOpen && (
            <button
              type="button"
              onClick={() => {
                setCancelOpen(true);
                setCancelError(null);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold border border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/10 transition"
            >
              <XCircle className="w-4 h-4" />
              إلغاء الطلب
            </button>
          )}
        </div>
      )}

      {order.status === 'new' && cancelOpen && (
        <div className="rounded-xl border border-red-500/40 p-3 space-y-3">
          <p className="text-sm font-bold">متأكد تريد تلغي الطلب #{order.order_no}؟</p>
          <div>
            <label htmlFor={`reason-${order.id}`} className="block text-xs text-muted mb-1">
              سبب الإلغاء (اختياري)
            </label>
            <textarea
              id={`reason-${order.id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={300}
              className={`${fieldClass} resize-y`}
            />
          </div>
          {cancelError && (
            <p role="alert" className="text-xs font-semibold text-red-600 dark:text-red-400">
              {cancelError}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={doCancel}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-60"
            >
              {busy ? 'جاري الإلغاء...' : 'نعم، ألغ الطلب'}
            </button>
            <button
              type="button"
              onClick={() => setCancelOpen(false)}
              disabled={busy}
              className={`${ghostBtn} px-4 py-2.5`}
            >
              رجوع
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

const STEP_ICONS = {
  new: ClipboardList,
  confirmed: Check,
  shipped: Truck,
  delivered: PackageCheck,
} as const;

function shortDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('ar-IQ', {
      timeZone: 'Asia/Baghdad',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '';
  }
}

function StatusStepper({ order }: { order: OrderRow }) {
  const idx = ORDER_STEPS.indexOf(order.status as (typeof ORDER_STEPS)[number]);
  const times: Record<(typeof ORDER_STEPS)[number], string | null> = {
    new: order.created_at,
    confirmed: order.confirmed_at,
    shipped: order.shipped_at,
    delivered: order.delivered_at,
  };
  return (
    <ol className="grid grid-cols-4 gap-1" aria-label="مراحل الطلب">
      {ORDER_STEPS.map((st, i) => {
        const done = i <= idx;
        const current = i === idx;
        const Icon = STEP_ICONS[st];
        return (
          <li
            key={st}
            className="relative flex flex-col items-center text-center"
            aria-current={current ? 'step' : undefined}
          >
            {i > 0 && (
              <span
                aria-hidden
                className={`absolute top-4 start-[-50%] w-full h-0.5 -translate-y-1/2 ${
                  done ? 'bg-primary' : 'bg-black/10 dark:bg-white/10'
                }`}
              />
            )}
            <span
              className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                done
                  ? 'bg-primary border-primary text-primary-foreground'
                  : 'card border-dark-border text-muted'
              } ${current ? 'ring-4 ring-primary/20' : ''}`}
            >
              <Icon className="w-4 h-4" />
            </span>
            <span className={`mt-1.5 text-[11px] leading-tight font-bold ${done ? '' : 'text-muted'}`}>
              {ORDER_STATUS[st].label}
            </span>
            {done && times[st] && (
              <span className="text-[10px] text-muted leading-tight">{shortDate(times[st])}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
