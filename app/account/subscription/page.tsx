'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Check,
  Crown,
  Calendar,
  AlertCircle,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/providers/AuthProvider';
import type { User } from '@supabase/supabase-js';

interface SubscriptionPlan {
  id: string;
  name_ar: string;
  description_ar: string | null;
  price_usd: number;
  price_iqd: number | null;
  duration_days: number;
  track: string;
}

const IQD_FMT = new Intl.NumberFormat('ar-IQ');

interface Subscription {
  id: string;
  status: string;
  plan_id: string;
  starts_at: string | null;
  expires_at: string | null;
  amount_usd: number;
  plan?: SubscriptionPlan;
}

export default function SubscriptionPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <SubscriptionPageInner />
    </Suspense>
  );
}

function SubscriptionPageInner() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Set by the ZainCash callback handler when the customer comes back from
  // the payment page. Show a top banner so they know the result.
  const zaincashStatus = searchParams.get('zaincash');

  const [currentSub, setCurrentSub] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutBusy, setCheckoutBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Send the user to login with `?next=` pointing back here so they
    // land on the subscription page after authenticating — otherwise the
    // OTP flow drops them on /chat and the subscription page disappears.
    if (!authLoading && !user) {
      router.replace('/login?next=' + encodeURIComponent('/account/subscription'));
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    void loadData(user);
  }, [user]);

  async function loadData(u: User) {
    setLoading(true);
    try {
      // Active subscription (if any).
      const { data: subRows } = await supabase
        .from('subscriptions')
        .select('*, plan:subscription_plans(*)')
        .eq('user_id', u.id)
        .in('status', ['active', 'pending'])
        .order('expires_at', { ascending: false })
        .limit(1);
      setCurrentSub((subRows?.[0] as Subscription) ?? null);

      // Available plans.
      const { data: planRows } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true });
      setPlans((planRows as SubscriptionPlan[]) ?? []);
    } catch (e) {
      console.error(e);
      setError('تعذّر تحميل بيانات الاشتراك');
    } finally {
      setLoading(false);
    }
  }

  async function startCheckout(planId: string) {
    setCheckoutBusy(planId);
    setError(null);
    try {
      // Attach the access token explicitly — supabase-js persists the
      // session in localStorage by default, so the server-side cookie
      // session is empty and /api/checkout would 401 without this header.
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers,
        body: JSON.stringify({ plan_id: planId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'تعذّر بدء عملية الدفع');
        return;
      }
      if (data.checkout_url) window.location.href = data.checkout_url;
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setCheckoutBusy(null);
    }
  }

  if (authLoading || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </main>
    );
  }
  if (!user) return null;

  const isActive =
    currentSub?.status === 'active' &&
    currentSub.expires_at &&
    new Date(currentSub.expires_at) > new Date();

  return (
    <main className="min-h-screen bg-background text-foreground" dir="rtl">
      <div className="max-w-4xl mx-auto px-5 py-10">
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowRight className="w-4 h-4" />
          العودة للدردشة
        </Link>

        <h1 className="text-3xl md:text-4xl font-bold mb-2">إدارة الاشتراك</h1>
        <p className="text-muted-foreground mb-8">
          راجع باقتك الحالية، أو جدّد للاستمرار في استخدام الأستاذ ذكي.
        </p>

        {error && (
          <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {zaincashStatus === 'success' && (
          <div className="mb-6 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-500">
            ✅ تم تأكيد الدفع بنجاح وتفعيل اشتراكك. شكراً لك!
          </div>
        )}
        {zaincashStatus === 'failed' && (
          <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            ❌ لم تكتمل عملية الدفع. إذا خُصم منك أي مبلغ فسيُرَدّ تلقائياً خلال 24 ساعة، حاول مجدداً أو استخدم رمز التفعيل.
          </div>
        )}
        {zaincashStatus === 'pending' && (
          <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-600">
            ⏳ الدفع لا يزال قيد المعالجة. سيتم تفعيل اشتراكك تلقائياً فور تأكيد ZainCash.
          </div>
        )}

        {/* Current subscription */}
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-4">باقتك الحالية</h2>
          {isActive && currentSub ? (
            <ActiveCard sub={currentSub} />
          ) : currentSub?.status === 'pending' ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
              <p className="font-semibold mb-1">طلبك تحت المراجعة</p>
              <p className="text-sm text-muted-foreground">
                إذا أكملت الدفع، سيُفعَّل الاشتراك تلقائياً خلال دقائق. وإن لم تُكمِل، اختر باقة بالأسفل لإعادة المحاولة.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card/40 p-6 text-center">
              <p className="text-muted-foreground mb-4">
                ليس لديك اشتراك نشط. اختر باقة بالأسفل للبدء.
              </p>
            </div>
          )}
        </section>

        {/* Redeem code */}
        <RedeemCodeSection onRedeemed={() => user && loadData(user)} />

        {/* Available plans */}
        <section>
          <h2 className="text-xl font-bold mb-4">
            {isActive ? 'تجديد أو تغيير الباقة' : 'الباقات المتاحة'}
          </h2>
          <div className="grid md:grid-cols-2 gap-5">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isCurrent={currentSub?.plan_id === plan.id && Boolean(isActive)}
                busy={checkoutBusy === plan.id}
                onSubscribe={() => startCheckout(plan.id)}
              />
            ))}
          </div>
        </section>

        <p className="text-xs text-muted-foreground mt-10 text-center">
          الدفع يتم عبر PayPro Global بشكل آمن. لمراجعة سياسة الاسترجاع{' '}
          <Link href="/refund" className="text-primary underline">
            اضغط هنا
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

// New pricing-model display labels. The DB `name_ar`/`description_ar` columns
// still hold the OLD model's copy, so we override by plan id everywhere a plan
// is shown to the user (current-plan card, plan grid, redeem toast).
const PLAN_LABELS: Record<string, { name: string; desc: string }> = {
  lifetime_access: {
    name: 'الباقة السنوية',
    desc: 'كل الأقسام والأستاذ ذكي لمدة سنة كاملة.',
  },
  chat_monthly: {
    name: 'الباقة الأساسية',
    desc: 'كل الأقسام لمدة سنة، والأستاذ ذكي يتجدد شهرياً.',
  },
  ai_refill: {
    name: 'إعادة تعبئة الذكاء الاصطناعي',
    desc: 'شهر إضافي من الأستاذ ذكي.',
  },
};

function planName(id?: string | null, fallback?: string | null): string {
  return (id && PLAN_LABELS[id]?.name) || fallback || id || '';
}

function planDesc(id?: string | null, fallback?: string | null): string | null {
  return (id && PLAN_LABELS[id]?.desc) || fallback || null;
}

function ActiveCard({ sub }: { sub: Subscription }) {
  const expiresAt = sub.expires_at ? new Date(sub.expires_at) : null;
  const daysLeft = expiresAt
    ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000))
    : 0;

  return (
    <div className="rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 to-primary/5 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-primary" />
          <span className="text-xs uppercase tracking-wide text-primary font-semibold">
            مفعّل
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {daysLeft} يوم متبقّي
        </span>
      </div>
      <h3 className="text-2xl font-bold mb-2">
        {planName(sub.plan_id, sub.plan?.name_ar)}
      </h3>
      {planDesc(sub.plan_id, sub.plan?.description_ar) && (
        <p className="text-sm text-muted-foreground mb-4">
          {planDesc(sub.plan_id, sub.plan?.description_ar)}
        </p>
      )}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Calendar className="w-4 h-4" />
          ينتهي:{' '}
          {expiresAt ? expiresAt.toLocaleDateString('ar-IQ') : '—'}
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  isCurrent,
  busy,
  onSubscribe,
}: {
  plan: SubscriptionPlan;
  isCurrent: boolean;
  busy: boolean;
  onSubscribe: () => void;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 flex flex-col gap-3 transition ${
        isCurrent
          ? 'border-primary/60 bg-primary/10'
          : 'border-border bg-card/40 hover:border-primary/40'
      }`}
    >
      {/* Names/descriptions come from PLAN_LABELS so the new pricing model
          reads correctly even though the DB still holds the old copy. */}
      <h3 className="font-bold text-lg">{planName(plan.id, plan.name_ar)}</h3>
      <p className="text-sm text-muted-foreground min-h-[40px]">
        {planDesc(plan.id, plan.description_ar)}
      </p>
      <div className="flex items-baseline gap-2 mt-2">
        {plan.price_iqd != null ? (
          <>
            <span className="text-3xl font-extrabold">
              {IQD_FMT.format(plan.price_iqd)}
            </span>
            <span className="text-sm text-muted-foreground">د.ع</span>
          </>
        ) : (
          <span className="text-3xl font-extrabold">${plan.price_usd}</span>
        )}
        <span className="text-xs text-muted-foreground">
          {plan.track === 'lifetime' ? 'سنوي — كل شيء' : 'الأقسام سنة + الذكاء شهري'}
        </span>
      </div>
      <ul className="text-sm text-muted-foreground space-y-1 mt-2 mb-4">
        {plan.track === 'lifetime' ? (
          <>
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-primary" /> كل الأقسام (المكتبة والمحاضرات والكتب) لمدة سنة
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-primary" /> الأستاذ ذكي لمدة سنة كاملة
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-primary" /> 50 سؤال نصي و5 صوتية يومياً
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-primary" /> بدون تجديد شهري للذكاء
            </li>
          </>
        ) : (
          <>
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-primary" /> كل الأقسام (المكتبة والمحاضرات والكتب) لمدة سنة
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-primary" /> الأستاذ ذكي لمدة شهر (يتجدد شهرياً)
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-primary" /> 50 سؤال نصي و5 صوتية يومياً
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-primary" /> حل المسائل بالصورة
            </li>
          </>
        )}
      </ul>
      {/* Yearly platform activation (250,000 IQD) is intentionally not
          sold via the online checkout — only via coupon codes the admin
          generates and hands out manually. The chat monthly plan goes
          through ZainCash. */}
      {plan.track === 'lifetime' ? (
        <div className="mt-auto space-y-2">
          <div className="rounded-xl border border-border bg-card/30 px-4 py-3 text-center text-xs text-muted-foreground">
            تفعيل هذه الباقة يتم عبر <span className="font-bold text-foreground">رمز تفعيل</span> تستلمه من فريق التفعيل. ادخل الرمز في الخانة أعلى الصفحة لتفعيله.
          </div>
          <Link
            href={`/activation-request?plan=${plan.id}`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold bg-primary text-primary-foreground hover:opacity-90 transition"
          >
            طلب رمز التفعيل
          </Link>
        </div>
      ) : (
        <button
          onClick={onSubscribe}
          disabled={busy || isCurrent}
          className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isCurrent ? 'مفعّل' : busy ? 'جاري...' : 'اشترك الآن'}
        </button>
      )}
    </div>
  );
}

/**
 * Lets a student paste a code they got from the seller (cash sale fallback
 * while we don't have an online payment gateway) and instantly activate the
 * matching plan. POST → /api/subscriptions/redeem.
 */
function RedeemCodeSection({ onRedeemed }: { onRedeemed: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const value = code.trim().toUpperCase();
    if (!value) {
      setError('أدخل الرمز أولاً');
      return;
    }
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const res = await fetch('/api/subscriptions/redeem', {
        method: 'POST',
        headers,
        body: JSON.stringify({ code: value }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        message?: string;
        plan_id?: string;
        plan_name?: string;
        expires_at?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.message || 'تعذّر تفعيل الاشتراك');
        return;
      }
      const expiry = data.expires_at ? new Date(data.expires_at) : null;
      setSuccess(
        `تم تفعيل: ${planName(data.plan_id, data.plan_name)}${expiry ? ` — ينتهي ${expiry.toLocaleDateString('ar-IQ')}` : ''}`,
      );
      setCode('');
      onRedeemed();
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-12">
      <h2 className="text-xl font-bold mb-3">هل لديك رمز تفعيل؟</h2>
      <p className="text-sm text-muted-foreground mb-4">
        إذا دفعت للموزّع نقداً واستلمت رمز تفعيل، فأدخله هنا لتفعيل الاشتراك مباشرة.
      </p>
      <form
        onSubmit={submit}
        className="flex flex-col sm:flex-row gap-2 max-w-xl"
      >
        <input
          dir="ltr"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="ادخل الرمز هنا"
          className="flex-1 rounded-xl border border-border bg-card/40 px-4 py-2.5 text-sm font-mono outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-primary text-primary-foreground font-bold px-5 py-2.5 text-sm hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'جاري...' : 'تفعيل'}
        </button>
      </form>
      {error && (
        <div className="mt-3 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2 max-w-xl">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-3 text-sm text-emerald-500 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 max-w-xl">
          {success}
        </div>
      )}
    </section>
  );
}
