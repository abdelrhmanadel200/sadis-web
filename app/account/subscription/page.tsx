'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Check,
  Crown,
  Calendar,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Layers,
  Sparkles,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/providers/AuthProvider';
import { computeEntitlements, type Entitlements, type SubRow } from '@/lib/entitlements';
import type { User } from '@supabase/supabase-js';

const IQD_FMT = new Intl.NumberFormat('ar-IQ');

// الباقتان اللتان تعرضان للطلب (إعادة التعبئة لها بطاقة خاصة بالأسفل).
const SELLABLE_PLANS = ['chat_monthly', 'lifetime_access'] as const;
// أسعار احتياطية إذا لم تقرأ من قاعدة البيانات.
const FALLBACK_PRICE_IQD: Record<string, number> = {
  chat_monthly: 25000,
  lifetime_access: 250000,
};

// أسماء ووصف الباقات من الكود: name_ar في قاعدة البيانات فيها صياغة النظام القديم.
const PLAN_LABELS: Record<string, { name: string; desc: string }> = {
  lifetime_access: {
    name: 'الباقة السنوية',
    desc: 'كل الأقسام والأستاذ ذكي سنة كاملة.',
  },
  chat_monthly: {
    name: 'الباقة الأساسية',
    desc: 'كل الأقسام سنة كاملة، والأستاذ ذكي شهر واحد تجدده برمز إعادة التعبئة.',
  },
  ai_refill: {
    name: 'إعادة تعبئة الذكاء الاصطناعي',
    desc: 'شهر إضافي من الأستاذ ذكي.',
  },
};

const REQUEST_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'قيد المراجعة', cls: 'bg-amber-500/15 text-amber-500 border-amber-500/30' },
  contacted: { label: 'تم التواصل معك', cls: 'bg-sky-500/15 text-sky-500 border-sky-500/30' },
  fulfilled: { label: 'تم التفعيل', cls: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' },
  rejected: { label: 'مرفوض', cls: 'bg-destructive/10 text-destructive border-destructive/30' },
};

interface MyRequest {
  id: string;
  plan_id: string;
  status: string;
  created_at: string;
  updated_at: string | null;
}

function planName(id?: string | null): string {
  return (id && PLAN_LABELS[id]?.name) || id || '';
}

function planDesc(id?: string | null): string | null {
  return (id && PLAN_LABELS[id]?.desc) || null;
}

function fmtDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString('ar-IQ', { timeZone: 'Asia/Baghdad' }) : '-';
}

function daysLeft(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

export default function SubscriptionPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [requests, setRequests] = useState<MyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // يرجع لنفس الصفحة بعد تسجيل الدخول بدل صفحة الدردشة.
    if (!authLoading && !user) {
      router.replace('/login?next=' + encodeURIComponent('/account/subscription'));
    }
  }, [user, authLoading, router]);

  // silent: تحديث بعد التفعيل بدون شاشة التحميل، حتى تبقى رسالة النجاح ظاهرة.
  const loadData = useCallback(async (u: User, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      // كل صفوف الطالب: باقة 25 ألف تمنح الأقسام سنة والأستاذ ذكي شهرا، والحالة
      // تحسب من الاستحقاقات لا من تاريخ انتهاء صف واحد.
      const [subsRes, plansRes, reqRes] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('plan_id, status, starts_at, expires_at')
          .eq('user_id', u.id)
          .order('starts_at', { ascending: false, nullsFirst: false }),
        supabase
          .from('subscription_plans')
          .select('id, price_iqd')
          .in('id', [...SELLABLE_PLANS]),
        supabase.rpc('my_subscription_requests'),
      ]);
      if (subsRes.error) throw subsRes.error;
      setEnt(computeEntitlements((subsRes.data ?? []) as SubRow[]));

      const priceMap: Record<string, number> = {};
      for (const p of (plansRes.data ?? []) as { id: string; price_iqd: number | null }[]) {
        if (p.price_iqd != null && p.price_iqd > 0) priceMap[p.id] = p.price_iqd;
      }
      setPrices(priceMap);

      if (reqRes.error) {
        console.error('my_subscription_requests', reqRes.error);
        setRequests([]);
      } else {
        setRequests(((reqRes.data ?? []) as MyRequest[]).filter((r) => r && r.id));
      }
    } catch (e) {
      console.error(e);
      setError('تعذر تحميل بيانات الاشتراك');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadData(user);
  }, [user, loadData]);

  if (authLoading || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </main>
    );
  }
  if (!user) return null;

  const isActive = Boolean(ent && (ent.sectionsActive || ent.aiActive));

  return (
    <main className="min-h-screen bg-background text-foreground" dir="rtl">
      <div className="max-w-4xl mx-auto px-4 sm:px-5 py-10">
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowRight className="w-4 h-4" />
          العودة للدردشة
        </Link>

        <h1 className="text-3xl md:text-4xl font-bold mb-2">إدارة الاشتراك</h1>
        <p className="text-muted-foreground mb-8">
          راجع باقتك الحالية ومواعيد الأقسام والأستاذ ذكي، أو اطلب رمز تفعيل جديد.
        </p>

        {error && (
          <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* الباقة الحالية */}
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-4">باقتك الحالية</h2>
          {ent && (isActive || ent.hasHistory) ? (
            <CurrentPlanCard ent={ent} />
          ) : (
            <div className="rounded-2xl border border-border bg-card/40 p-6 text-center">
              <p className="text-muted-foreground">
                ليس لديك اشتراك مفعل. اطلب رمز التفعيل من الباقات بالأسفل، أو ادخل رمزك في الخانة التالية.
              </p>
            </div>
          )}
        </section>

        {requests.length > 0 && <RequestsSection requests={requests} />}

        <RedeemCodeSection onRedeemed={() => void loadData(user, true)} />

        {/* الباقات */}
        <section>
          <h2 className="text-xl font-bold mb-4">
            {isActive ? 'تجديد أو تغيير الباقة' : 'الباقات المتاحة'}
          </h2>
          <div className="grid md:grid-cols-2 gap-5">
            {SELLABLE_PLANS.map((id) => (
              <PlanCard
                key={id}
                planId={id}
                priceIqd={prices[id] ?? FALLBACK_PRICE_IQD[id]}
                ent={ent}
              />
            ))}
            <RefillCard ent={ent} />
          </div>
        </section>

        <p className="text-xs text-muted-foreground mt-10 text-center">
          تفعيل الباقات يتم برمز تستلمه من فريق التفعيل. لمراجعة سياسة الاسترجاع{' '}
          <Link href="/refund" className="text-primary underline">
            اضغط هنا
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

function CurrentPlanCard({ ent }: { ent: Entitlements }) {
  const active = ent.sectionsActive || ent.aiActive;
  const planId = ent.sectionsActive
    ? ent.sectionsPlanId
    : ent.aiActive
      ? ent.aiPlanId
      : ent.sectionsPlanId ?? ent.aiPlanId;
  const endIso = ent.sectionsActive ? ent.sectionsExpiresAt : ent.aiExpiresAt;
  const left = active ? daysLeft(endIso) : 0;
  const aiLeft = daysLeft(ent.aiExpiresAt);

  return (
    <div
      className={`rounded-2xl border p-5 sm:p-6 ${
        active
          ? 'border-primary/40 bg-gradient-to-br from-primary/15 to-primary/5'
          : 'border-border bg-card/40'
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Crown className={`w-5 h-5 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
          <span
            className={`text-xs font-semibold ${active ? 'text-primary' : 'text-muted-foreground'}`}
          >
            {active ? 'مفعل' : 'منتهي'}
          </span>
        </div>
        {active && <span className="text-xs text-muted-foreground">باقي {left} يوم</span>}
      </div>
      <h3 className="text-2xl font-bold mb-2">{planName(planId)}</h3>
      {planDesc(planId) && (
        <p className="text-sm text-muted-foreground mb-4">{planDesc(planId)}</p>
      )}

      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        {/* الأقسام */}
        <div
          className={`rounded-xl border p-4 ${
            ent.sectionsActive ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border bg-card/30'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="flex items-center gap-2 font-bold">
              <Layers className="w-4 h-4 text-primary" /> الأقسام
            </span>
            <StatusPill
              on={ent.sectionsActive}
              label={
                ent.sectionsActive
                  ? `مفعلة · باقي ${daysLeft(ent.sectionsExpiresAt)} يوم`
                  : ent.lastSectionsExpiresAt
                    ? 'منتهية'
                    : 'غير مفعلة'
              }
            />
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            {ent.sectionsActive ? (
              <>
                <DateLine label="بدأت" iso={ent.sectionsStartsAt} />
                <DateLine label="تنتهي" iso={ent.sectionsExpiresAt} />
              </>
            ) : ent.lastSectionsExpiresAt ? (
              <>
                <DateLine label="انتهت في" iso={ent.lastSectionsExpiresAt} />
                <p>اطلب رمز الباقة الأساسية أو السنوية لتفعيلها من جديد.</p>
              </>
            ) : (
              <p>الأقسام غير مشمولة في اشتراكك الحالي.</p>
            )}
          </div>
        </div>

        {/* الأستاذ ذكي */}
        <div
          className={`rounded-xl border p-4 ${
            ent.aiActive ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border bg-card/30'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="flex items-center gap-2 font-bold">
              <Sparkles className="w-4 h-4 text-primary" /> الأستاذ ذكي
            </span>
            <StatusPill
              on={ent.aiActive}
              label={
                ent.aiActive
                  ? `مفعل · باقي ${aiLeft} يوم`
                  : ent.lastAiExpiresAt
                    ? 'منتهي'
                    : 'غير مفعل'
              }
            />
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            {ent.aiActive ? (
              <>
                <p>
                  النوع:{' '}
                  <span className="text-foreground font-semibold">
                    {ent.aiYearly ? 'سنوي' : 'شهري'}
                  </span>
                </p>
                <DateLine label="بدأ" iso={ent.aiStartsAt} />
                <DateLine label="ينتهي" iso={ent.aiExpiresAt} />
                {!ent.aiYearly && (
                  <p className="pt-1">
                    تجدده برمز إعادة التعبئة، والشهر الجديد يبدأ بعد انتهاء الشهر الحالي.
                  </p>
                )}
              </>
            ) : ent.lastAiExpiresAt ? (
              <>
                <DateLine label="انتهى في" iso={ent.lastAiExpiresAt} />
                {ent.sectionsActive && (
                  <p className="text-amber-500 pt-1">
                    انتهى شهر الأستاذ ذكي وأقسامك ما زالت مفعلة.{' '}
                    <Link href="/activation-request?plan=ai_refill" className="underline font-semibold">
                      اطلب رمز إعادة التعبئة
                    </Link>
                  </p>
                )}
              </>
            ) : (
              <p>الأستاذ ذكي غير مفعل في اشتراكك الحالي.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`shrink-0 text-[11px] rounded-full px-2.5 py-0.5 font-bold ${
        on ? 'bg-emerald-500/15 text-emerald-500' : 'bg-destructive/10 text-destructive'
      }`}
    >
      {label}
    </span>
  );
}

function DateLine({ label, iso }: { label: string; iso: string | null }) {
  return (
    <p className="flex items-center gap-1.5">
      <Calendar className="w-3.5 h-3.5 shrink-0" />
      {label}: <span className="text-foreground font-semibold">{fmtDate(iso)}</span>
    </p>
  );
}

function RequestsSection({ requests }: { requests: MyRequest[] }) {
  const hasContacted = requests.some((r) => r.status === 'contacted');
  return (
    <section className="mb-12">
      <h2 className="text-xl font-bold mb-4">طلباتي</h2>
      <ul className="space-y-2">
        {requests.map((r) => {
          const st = REQUEST_STATUS[r.status] ?? {
            label: r.status,
            cls: 'bg-card/40 text-muted-foreground border-border',
          };
          const changed = r.status !== 'pending' && r.updated_at && r.updated_at !== r.created_at;
          return (
            <li
              key={r.id}
              className="rounded-xl border border-border bg-card/40 px-4 py-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="font-semibold text-sm">{planName(r.plan_id)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  أرسل في {fmtDate(r.created_at)}
                  {changed ? ` · آخر تحديث ${fmtDate(r.updated_at)}` : ''}
                </p>
              </div>
              <span className={`shrink-0 text-xs font-bold rounded-full border px-2.5 py-1 ${st.cls}`}>
                {st.label}
              </span>
            </li>
          );
        })}
      </ul>
      {hasContacted && (
        <p className="text-xs text-muted-foreground mt-3">
          إذا وصلك رمز من فريق التفعيل، ادخله في خانة الرمز بالأسفل.
        </p>
      )}
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-1" /> <span>{children}</span>
    </li>
  );
}

function RequestLink({ planId }: { planId: string }) {
  return (
    <Link
      href={`/activation-request?plan=${planId}`}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold bg-primary text-primary-foreground hover:opacity-90 transition"
    >
      طلب رمز التفعيل
    </Link>
  );
}

function PlanCard({
  planId,
  priceIqd,
  ent,
}: {
  planId: string;
  priceIqd: number | undefined;
  ent: Entitlements | null;
}) {
  const yearly = planId === 'lifetime_access';
  const secLeft = ent?.sectionsActive ? daysLeft(ent.sectionsExpiresAt) : 0;
  const isCurrent = Boolean(ent?.sectionsActive && ent.sectionsPlanId === planId);
  // الرمز يقبل للتجديد عندما يبقى شهر أو أقل.
  const renewDue = isCurrent && secLeft <= 30;
  const basicBlocked = !yearly && !isCurrent && Boolean(ent?.sectionsActive) && secLeft > 30;

  return (
    <div
      className={`rounded-2xl border p-5 flex flex-col gap-3 transition ${
        isCurrent ? 'border-primary/60 bg-primary/10' : 'border-border bg-card/40 hover:border-primary/40'
      }`}
    >
      <h3 className="font-bold text-lg">{planName(planId)}</h3>
      <p className="text-sm text-muted-foreground min-h-[40px]">{planDesc(planId)}</p>
      <div className="flex flex-wrap items-baseline gap-2 mt-2">
        {priceIqd != null && (
          <>
            <span className="text-3xl font-extrabold">{IQD_FMT.format(priceIqd)}</span>
            <span className="text-sm text-muted-foreground">د.ع</span>
          </>
        )}
        <span className="text-xs text-muted-foreground">
          {yearly ? 'الأقسام والأستاذ ذكي سنة كاملة' : 'الأقسام سنة + الأستاذ ذكي شهر'}
        </span>
      </div>
      <ul className="text-sm text-muted-foreground space-y-1 mt-2 mb-4">
        <Bullet>كل الأقسام (المكتبة والمحاضرات والكتب) لمدة سنة</Bullet>
        {yearly ? (
          <>
            <Bullet>الأستاذ ذكي لمدة سنة كاملة</Bullet>
            <Bullet>50 سؤال نصي و5 صوتية يوميا</Bullet>
            <Bullet>بدون تجديد شهري للأستاذ ذكي</Bullet>
          </>
        ) : (
          <>
            <Bullet>الأستاذ ذكي لمدة شهر، وتجدده برمز إعادة التعبئة</Bullet>
            <Bullet>50 سؤال نصي و5 صوتية يوميا</Bullet>
            <Bullet>حل المسائل بالصورة</Bullet>
          </>
        )}
      </ul>
      <div className="mt-auto space-y-2">
        <div className="rounded-xl border border-border bg-card/30 px-4 py-3 text-center text-xs text-muted-foreground">
          تفعيل هذه الباقة يتم عبر <span className="font-bold text-foreground">رمز تفعيل</span> تستلمه
          من فريق التفعيل، ثم تدخله في خانة الرمز أعلى الصفحة.
        </div>
        {basicBlocked && ent && (
          <p className="text-xs text-amber-500">
            أقسامك مفعلة حتى {fmtDate(ent.sectionsExpiresAt)}، ورمز هذه الباقة يقبل عندما يبقى شهر أو أقل.
          </p>
        )}
        {isCurrent && !renewDue ? (
          <div className="inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
            مفعلة حتى {fmtDate(ent?.sectionsExpiresAt)}
          </div>
        ) : (
          <>
            {renewDue && ent && (
              <p className="text-xs text-amber-500">
                باقتك تنتهي في {fmtDate(ent.sectionsExpiresAt)}، يمكنك تجديدها الآن.
              </p>
            )}
            <RequestLink planId={planId} />
          </>
        )}
      </div>
    </div>
  );
}

// إعادة تعبئة الأستاذ ذكي: شهر يبدأ بعد انتهاء الشهر الحالي، تطلب بالرمز مثل بقية الباقات.
function RefillCard({ ent }: { ent: Entitlements | null }) {
  const aiLeft = ent?.aiActive ? daysLeft(ent.aiExpiresAt) : 0;
  return (
    <div className="rounded-2xl border border-border bg-card/40 hover:border-primary/40 p-5 flex flex-col gap-3 transition">
      <h3 className="font-bold text-lg">{planName('ai_refill')}</h3>
      <p className="text-sm text-muted-foreground min-h-[40px]">
        شهر إضافي من الأستاذ ذكي. إذا كان شهرك الحالي ما زال مفعلا، يبدأ الشهر الجديد بعد انتهائه.
      </p>
      <ul className="text-sm text-muted-foreground space-y-1 mt-2 mb-4">
        <Bullet>الأستاذ ذكي لمدة شهر كامل</Bullet>
        <Bullet>50 سؤال نصي و5 صوتية يوميا</Bullet>
        <Bullet>حل المسائل بالصورة</Bullet>
      </ul>
      <div className="mt-auto space-y-2">
        <div className="rounded-xl border border-border bg-card/30 px-4 py-3 text-center text-xs text-muted-foreground">
          تفعل عبر <span className="font-bold text-foreground">رمز تفعيل</span> تستلمه من فريق التفعيل.
        </div>
        {ent?.aiActive && aiLeft > 30 && (
          <p className="text-xs text-amber-500">
            الأستاذ ذكي مفعل عندك حتى {fmtDate(ent.aiExpiresAt)}، ورمز التعبئة يقبل عندما يبقى شهر أو أقل.
          </p>
        )}
        <RequestLink planId="ai_refill" />
      </div>
    </div>
  );
}

/**
 * الطالب يدخل الرمز الذي استلمه من الموزع فيتفعل اشتراكه مباشرة.
 * POST /api/subscriptions/redeem
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
    const value = code.trim();
    if (!value.replace(/\s/g, '')) {
      setError('أدخل الرمز أولا');
      return;
    }
    setBusy(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('سجل دخولك أولا');
        return;
      }
      const res = await fetch('/api/subscriptions/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ code: value }),
      });
      let data: {
        ok?: boolean;
        message?: string;
        plan_id?: string;
        plan_name?: string;
        sections_expires_at?: string | null;
        ai_expires_at?: string | null;
      } | null = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (!res.ok || !data?.ok) {
        setError(data?.message || `تعذر تفعيل الرمز (خطأ ${res.status})`);
        return;
      }
      const parts: string[] = [];
      if (data.sections_expires_at) parts.push(`الأقسام حتى ${fmtDate(data.sections_expires_at)}`);
      if (data.ai_expires_at) parts.push(`الأستاذ ذكي حتى ${fmtDate(data.ai_expires_at)}`);
      const name = PLAN_LABELS[data.plan_id ?? '']?.name || data.plan_name || data.plan_id || '';
      setSuccess(`تم تفعيل: ${name}${parts.length ? `. ${parts.join('، ')}` : ''}`);
      setCode('');
      onRedeemed();
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-12">
      <h2 className="text-xl font-bold mb-3">هل لديك رمز تفعيل؟</h2>
      <p className="text-sm text-muted-foreground mb-4">
        إذا دفعت للموزع واستلمت رمز التفعيل، ادخله هنا ليتفعل اشتراكك مباشرة. يمكنك كتابة الأرقام
        بالعربي أو بالإنجليزي.
      </p>
      <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2 max-w-xl">
        <input
          dir="ltr"
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="1234 5678 9012 3456"
          aria-label="رمز التفعيل"
          className="flex-1 rounded-xl border border-border bg-card/40 px-4 py-2.5 text-sm font-mono tracking-wider text-left outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-primary text-primary-foreground font-bold px-5 py-2.5 text-sm hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'جاري التفعيل...' : 'تفعيل'}
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
