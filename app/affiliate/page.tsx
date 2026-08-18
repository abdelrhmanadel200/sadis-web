'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Copy,
  Check,
  Users,
  Wallet,
  Link2,
  Handshake,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/providers/AuthProvider';

interface Affiliate {
  user_id: string;
  code: string;
  commission_pct: number;
  active: boolean;
}

interface Referral {
  referred_user_id: string;
  status: string;
  created_at: string;
}

interface Commission {
  id: string;
  plan_id: string | null;
  amount_iqd: number;
  pct: number;
  status: string;
  created_at: string;
}

interface Payout {
  id: string;
  amount_iqd: number;
  method: string | null;
  account_number: string | null;
  status: string;
  admin_note: string | null;
  requested_at: string;
  settled_at: string | null;
}

const PAYOUT_STATUS: Record<string, { label: string; classes: string }> = {
  requested: { label: 'قيد المعالجة', classes: 'bg-amber-500/15 text-amber-500 border-amber-500/30' },
  paid: { label: 'تم الصرف', classes: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' },
  rejected: { label: 'مرفوض', classes: 'bg-destructive/15 text-destructive border-destructive/30' },
};

const PAYOUT_METHODS = [
  { id: 'zaincash', label: 'زين كاش' },
  { id: 'asiacell', label: 'آسيا سيل' },
  { id: 'cash', label: 'استلام نقدي' },
];

const COMMISSION_STATUS: Record<string, { label: string; classes: string }> = {
  pending: { label: 'قيد المراجعة', classes: 'bg-amber-500/15 text-amber-500 border-amber-500/30' },
  approved: { label: 'معتمدة', classes: 'bg-primary/15 text-primary border-primary/30' },
  paid: { label: 'مدفوعة', classes: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' },
  cancelled: { label: 'ملغاة', classes: 'bg-destructive/15 text-destructive border-destructive/30' },
};

const IQD = new Intl.NumberFormat('ar-IQ');

export default function AffiliatePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  // طلب سحب الأرباح
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [poMethod, setPoMethod] = useState('zaincash');
  const [poAccount, setPoAccount] = useState('');
  const [poName, setPoName] = useState('');
  const [poNote, setPoNote] = useState('');
  const [poBusy, setPoBusy] = useState(false);
  const [poError, setPoError] = useState<string | null>(null);
  const [minPayout, setMinPayout] = useState<number>(0);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: aff } = await supabase
      .from('affiliates')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    setAffiliate((aff as Affiliate) ?? null);
    if (aff) {
      const [{ data: refs }, { data: comms }, { data: pos }, { data: setting }] = await Promise.all([
        supabase
          .from('referrals')
          .select('referred_user_id, status, created_at')
          .eq('affiliate_user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('affiliate_commissions')
          .select('id, plan_id, amount_iqd, pct, status, created_at')
          .eq('affiliate_user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('affiliate_payouts')
          .select('id, amount_iqd, method, account_number, status, admin_note, requested_at, settled_at')
          .eq('affiliate_user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase.from('app_settings').select('value').eq('key', 'min_payout_iqd').maybeSingle(),
      ]);
      setReferrals((refs ?? []) as Referral[]);
      setCommissions((comms ?? []) as Commission[]);
      setPayouts((pos ?? []) as Payout[]);
      // حد المسوّق الخاص يتقدّم على الحد العام.
      const globalMin = Number((setting as { value?: string } | null)?.value ?? 0) || 0;
      const own = (aff as { min_payout_iqd?: number | null }).min_payout_iqd;
      setMinPayout(own === null || own === undefined ? globalMin : Number(own) || 0);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const join = async () => {
    setJoining(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc('become_affiliate');
      if (rpcErr) throw rpcErr;
      setAffiliate(data as Affiliate);
      await load();
    } catch {
      setError('تعذّر التسجيل، حاول مرة ثانية.');
    } finally {
      setJoining(false);
    }
  };

  // طلب صرف المستحقات. الرصيد يُحتسب في قاعدة البيانات (RPC) وليس هنا.
  const requestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setPoError(null);
    if (!poAccount.trim() && poMethod !== 'cash') {
      setPoError('أدخل رقم المحفظة/الهاتف لاستلام المبلغ.');
      return;
    }
    setPoBusy(true);
    try {
      const { error: rpcErr } = await supabase.rpc('request_payout', {
        p_method: poMethod,
        p_account: poAccount.trim() || null,
        p_full_name: poName.trim() || null,
        p_note: poNote.trim() || null,
      });
      if (rpcErr) {
        const msg = rpcErr.message ?? '';
        setPoError(
          msg.includes('no balance')
            ? 'لا يوجد رصيد مستحق للسحب حالياً.'
            : msg.includes('below minimum')
              ? `الحد الأدنى للسحب هو ${IQD.format(minPayout)} د.ع — واصل التسويق حتى تبلغه.`
              : 'تعذّر إرسال الطلب، حاول مرة ثانية.',
        );
        return;
      }
      setShowPayoutForm(false);
      setPoAccount('');
      setPoName('');
      setPoNote('');
      await load();
    } finally {
      setPoBusy(false);
    }
  };

  const pendingPayout = payouts.find((p) => p.status === 'requested') ?? null;

  const refLink = affiliate
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://www.6thultra.com'}/register?ref=${affiliate.code}`
    : '';

  const copy = async (what: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(what === 'code' ? affiliate!.code : refLink);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  };

  const converted = referrals.filter((r) => r.status === 'converted').length;
  const total = (s: string) =>
    commissions.filter((c) => c.status === s).reduce((sum, c) => sum + Number(c.amount_iqd || 0), 0);

  return (
    <main className="min-h-screen bg-background text-foreground" dir="rtl">
      <div className="max-w-3xl mx-auto px-5 py-10">
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 text-sm text-muted hover:opacity-80 mb-6"
        >
          <ArrowRight className="w-4 h-4" />
          العودة
        </Link>

        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 flex items-center gap-2">
            <Handshake className="w-8 h-8 text-primary" />
            نظام المسوّقين
          </h1>
          <p className="text-muted">
            شارك رابطك أو كودك مع زملائك — وكل طالب يشترك عن طريقك تحصل على عمولة من قيمة اشتراكه.
          </p>
        </header>

        {loading || authLoading ? (
          <div className="py-10 text-center text-muted flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> جاري التحميل...
          </div>
        ) : !affiliate ? (
          <div className="card border border-dark-border rounded-2xl p-8 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mb-4">
              <Handshake className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-2">انضم كمسوّق</h2>
            <p className="text-muted mb-6 leading-relaxed">
              سجّل الآن وستحصل على كود ورابط خاصّين بك. أي طالب يسجّل عبرهما ويشترك،
              تُحسب لك عمولة تلقائياً.
            </p>
            <button
              onClick={join}
              disabled={joining}
              className="rounded-xl bg-primary text-primary-foreground font-bold px-8 py-3 hover:opacity-90 disabled:opacity-50"
            >
              {joining ? 'جاري التسجيل...' : 'سجّلني كمسوّق'}
            </button>
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          </div>
        ) : (
          <div className="space-y-6">
            {!affiliate.active && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3">
                حسابك التسويقي موقوف حالياً — تواصل مع الإدارة.
              </div>
            )}

            {/* Code + link */}
            <div className="card border border-dark-border rounded-2xl p-5 space-y-4">
              <div>
                <p className="text-sm text-muted mb-1.5">كودك الخاص</p>
                <div className="flex items-center gap-2">
                  <span
                    dir="ltr"
                    className="font-mono font-bold text-xl tracking-widest bg-primary/10 text-primary rounded-xl px-4 py-2"
                  >
                    {affiliate.code}
                  </span>
                  <button
                    onClick={() => copy('code')}
                    className="p-2.5 rounded-xl border border-dark-border hover:border-primary/40"
                    aria-label="نسخ الكود"
                  >
                    {copied === 'code' ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted mb-1.5">رابط الإحالة</p>
                <div className="flex items-center gap-2">
                  <span
                    dir="ltr"
                    className="flex-1 min-w-0 truncate text-sm bg-card/40 border border-dark-border rounded-xl px-3 py-2.5"
                  >
                    {refLink}
                  </span>
                  <button
                    onClick={() => copy('link')}
                    className="p-2.5 rounded-xl border border-dark-border hover:border-primary/40"
                    aria-label="نسخ الرابط"
                  >
                    {copied === 'link' ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Link2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted mt-2">
                  نسبة عمولتك الحالية: <b>{Number(affiliate.commission_pct)}%</b> من قيمة كل اشتراك.
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat icon={Users} label="التسجيلات عبرك" value={String(referrals.length)} />
              <Stat icon={Check} label="اشتركوا فعلاً" value={String(converted)} />
              <Stat
                icon={Wallet}
                label="عمولات قيد المراجعة"
                value={`${IQD.format(total('pending') + total('approved'))} د.ع`}
              />
              <Stat icon={Wallet} label="عمولات مدفوعة" value={`${IQD.format(total('paid'))} د.ع`} />
            </div>

            {/* سحب الأرباح */}
            <div className="card border border-dark-border rounded-2xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div>
                  <h2 className="font-bold text-lg">سحب الأرباح</h2>
                  <p className="text-sm text-muted">
                    الرصيد المتاح للسحب:{' '}
                    <b className="text-foreground">
                      {IQD.format(total('pending') + total('approved'))} د.ع
                    </b>
                    {minPayout > 0 && (
                      <>
                        {' '}— الحد الأدنى للسحب{' '}
                        <b className="text-foreground">{IQD.format(minPayout)} د.ع</b>
                      </>
                    )}
                  </p>
                </div>
                {!pendingPayout && total('pending') + total('approved') >= Math.max(minPayout, 1) && (
                  <button
                    onClick={() => setShowPayoutForm((v) => !v)}
                    className="rounded-xl bg-primary text-primary-foreground font-bold px-5 py-2.5 text-sm hover:opacity-90"
                  >
                    {showPayoutForm ? 'إلغاء' : 'اطلب أرباحي'}
                  </button>
                )}
              </div>

              {pendingPayout && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
                  لديك طلب سحب قيد المعالجة بمبلغ{' '}
                  <b>{IQD.format(Number(pendingPayout.amount_iqd))} د.ع</b> — سيتواصل معك فريق
                  المنصة قريباً.
                </div>
              )}

              {!pendingPayout && total('pending') + total('approved') <= 0 && (
                <p className="text-sm text-muted py-2">
                  لا يوجد رصيد للسحب حالياً — كل عمولة جديدة تُضاف هنا تلقائياً.
                </p>
              )}

              {!pendingPayout &&
                total('pending') + total('approved') > 0 &&
                total('pending') + total('approved') < minPayout && (
                  <p className="text-sm text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5">
                    تحتاج{' '}
                    <b>{IQD.format(minPayout - (total('pending') + total('approved')))} د.ع</b> إضافية
                    لتتمكّن من طلب السحب (الحد الأدنى {IQD.format(minPayout)} د.ع).
                  </p>
                )}

              {showPayoutForm && !pendingPayout && (
                <form onSubmit={requestPayout} className="mt-4 space-y-3 max-w-lg">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold mb-1.5">طريقة الاستلام</label>
                      <select
                        value={poMethod}
                        onChange={(e) => setPoMethod(e.target.value)}
                        className="w-full rounded-xl border border-dark-border bg-card/40 px-4 py-2.5 text-sm outline-none focus:border-primary"
                      >
                        {PAYOUT_METHODS.map((m) => (
                          <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1.5">
                        {poMethod === 'cash' ? 'رقم هاتفك' : 'رقم المحفظة / الهاتف'}
                      </label>
                      <input
                        dir="ltr"
                        value={poAccount}
                        onChange={(e) => setPoAccount(e.target.value)}
                        placeholder="07XXXXXXXXX"
                        className="w-full rounded-xl border border-dark-border bg-card/40 px-4 py-2.5 text-sm outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1.5">الاسم الكامل</label>
                    <input
                      value={poName}
                      onChange={(e) => setPoName(e.target.value)}
                      className="w-full rounded-xl border border-dark-border bg-card/40 px-4 py-2.5 text-sm outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1.5">ملاحظة (اختياري)</label>
                    <input
                      value={poNote}
                      onChange={(e) => setPoNote(e.target.value)}
                      className="w-full rounded-xl border border-dark-border bg-card/40 px-4 py-2.5 text-sm outline-none focus:border-primary"
                    />
                  </div>
                  {poError && (
                    <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
                      {poError}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={poBusy}
                    className="rounded-xl bg-primary text-primary-foreground font-bold px-5 py-2.5 text-sm hover:opacity-90 disabled:opacity-50"
                  >
                    {poBusy ? 'جاري الإرسال...' : 'إرسال الطلب'}
                  </button>
                </form>
              )}

              {payouts.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h3 className="text-sm font-semibold text-muted">سجل الطلبات</h3>
                  {payouts.map((p) => {
                    const meta = PAYOUT_STATUS[p.status] ?? PAYOUT_STATUS.requested;
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-dark-border px-4 py-2.5 text-sm"
                      >
                        <span className="font-semibold">
                          {IQD.format(Number(p.amount_iqd))} د.ع
                        </span>
                        <span className="text-xs text-muted">
                          {new Date(p.requested_at).toLocaleDateString('ar-IQ')}
                        </span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${meta.classes}`}>
                          {meta.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Commissions list */}
            <div className="card border border-dark-border rounded-2xl p-5">
              <h2 className="font-bold text-lg mb-3">عمولاتك</h2>
              {commissions.length === 0 ? (
                <p className="text-sm text-muted py-4 text-center">
                  لا توجد عمولات بعد — شارك رابطك وابدأ الربح.
                </p>
              ) : (
                <div className="space-y-2">
                  {commissions.map((c) => {
                    const meta = COMMISSION_STATUS[c.status] ?? COMMISSION_STATUS.pending;
                    return (
                      <div
                        key={c.id}
                        className="flex items-center justify-between gap-3 border border-dark-border rounded-xl px-4 py-3"
                      >
                        <div>
                          <p className="font-bold">{IQD.format(Number(c.amount_iqd))} د.ع</p>
                          <p className="text-xs text-muted">
                            {new Date(c.created_at).toLocaleDateString('ar-IQ')} · {Number(c.pct)}%
                          </p>
                        </div>
                        <span className={`text-[11px] px-2.5 py-1 rounded-full border ${meta.classes}`}>
                          {meta.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="card border border-dark-border rounded-2xl p-4">
      <Icon className="w-5 h-5 text-primary mb-2" />
      <p className="font-bold text-lg leading-tight">{value}</p>
      <p className="text-xs text-muted mt-1">{label}</p>
    </div>
  );
}
