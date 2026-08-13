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
      const [{ data: refs }, { data: comms }] = await Promise.all([
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
      ]);
      setReferrals((refs ?? []) as Referral[]);
      setCommissions((comms ?? []) as Commission[]);
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
