'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Phone,
  Mail,
  ShieldCheck,
  Loader2,
  Check,
  AlertCircle,
  Sparkles,
  Layers,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { computeEntitlements, type SubRow } from '@/lib/entitlements';

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

const daysLeft = (iso: string | null) =>
  iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)) : 0;

/** الاسم الظاهر للطالب لكل باقة (لا نثق بأسماء القاعدة). */
const PLAN_LABEL: Record<string, string> = {
  chat_monthly: 'الباقة الأساسية (25 ألف)',
  lifetime_access: 'الباقة السنوية (250 ألف)',
  ai_refill: 'إعادة تعبئة الذكاء الاصطناعي',
};

/**
 * نفس تطبيع صفحة الدخول بالهاتف: 00 → +، الأرقام المحلية العراقية → +964.
 * لو اختلف التطبيع لما طابق الرقمُ المربوط الدخولَ بالهاتف لاحقاً.
 */
function toE164(raw: string): string | null {
  let p = raw.replace(/[\s\-()]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (p.startsWith('+')) return /^\+\d{8,15}$/.test(p) ? p : null;
  if (p.startsWith('0')) p = p.slice(1);
  return /^\d{9,10}$/.test(p) ? '+964' + p : null;
}

/* ═════════════════ بيانات التواصل + ربط الموبايل ═════════════════ */

export function ContactSection({ user, profilePhone }: { user: User; profilePhone: string | null }) {
  const phone = user.phone || profilePhone || null;
  // الحساب الاصطناعي لمن سجّل بالهاتف ليس إيميلاً حقيقياً يُعرض.
  const email = user.email && !user.email.endsWith('@phone.sadisultra.local') ? user.email : null;

  const [linkOpen, setLinkOpen] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [linkedPhone, setLinkedPhone] = useState<string | null>(null);

  const shown = linkedPhone || phone;

  const authHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`;
    return h;
  };

  const sendCode = async () => {
    setMsg(null);
    const p = toE164(newPhone);
    if (!p) {
      setMsg({ ok: false, text: 'أدخل رقم هاتف صحيح مثل 07701234567.' });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/phone-otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: p }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: data.message || 'تعذّر إرسال الرمز.' });
        return;
      }
      setStep('code');
      setMsg({ ok: true, text: 'أرسلنا رمز التحقق لرقمك.' });
    } catch {
      setMsg({ ok: false, text: 'تعذّر الاتصال بالخادم.' });
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async () => {
    setMsg(null);
    const p = toE164(newPhone);
    if (!p) {
      setMsg({ ok: false, text: 'أدخل رقم هاتف صحيح.' });
      return;
    }
    if (!/^\d{4}$/.test(code.trim())) {
      setMsg({ ok: false, text: 'أدخل الرمز المكوّن من 4 أرقام.' });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/phone-otp/link', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ phone: p, code: code.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        // رقم محجوز أو رمز لم يعد صالحا أو خطأ في الخادم: ارجع لخطوة الرقم ليطلب رمزا جديدا.
        if (res.status === 409 || res.status === 429 || res.status >= 500) {
          setStep('phone');
          setCode('');
        }
        setMsg({ ok: false, text: data.message || 'تعذّر ربط الرقم.' });
        return;
      }
      setLinkedPhone(data.phone);
      setLinkOpen(false);
      setStep('phone');
      setCode('');
      setMsg({ ok: true, text: 'تم ربط رقمك بحسابك ✅ تقدر تدخل به من الآن.' });
      // حدّث الجلسة حتى يظهر الرقم الجديد في كل الصفحات بلا إعادة تحميل.
      void supabase.auth.refreshSession();
    } catch {
      setMsg({ ok: false, text: 'تعذّر الاتصال بالخادم.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card border border-dark-border rounded-2xl p-5">
      <h2 className="font-cairo font-bold text-lg mb-4 flex items-center gap-2">
        <Phone className="w-5 h-5 text-primary-light" />
        بيانات التواصل
      </h2>
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-xl border border-dark-border px-4 py-3">
          <span className="flex items-center gap-2 text-sm text-muted"><Mail className="w-4 h-4" /> البريد الإلكتروني</span>
          <span dir="ltr" className="text-sm font-semibold">{email || 'غير مرتبط'}</span>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-dark-border px-4 py-3">
          <span className="flex items-center gap-2 text-sm text-muted"><Phone className="w-4 h-4" /> رقم الموبايل</span>
          {shown ? (
            <span dir="ltr" className="text-sm font-semibold">+{shown.replace(/^\+/, '')}</span>
          ) : (
            <button onClick={() => { setLinkOpen((v) => !v); setMsg(null); }} className="text-sm font-bold text-primary-light hover:underline">
              ربط رقم موبايل بالحساب
            </button>
          )}
        </div>

        {linkOpen && !shown && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            {step === 'phone' ? (
              <>
                <label className="block text-xs font-semibold text-muted">رقم الموبايل</label>
                <input
                  dir="ltr"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="07XXXXXXXXX"
                  className="input-field w-full rounded-xl px-3 py-2 outline-none focus:border-primary"
                />
                <button onClick={sendCode} disabled={busy} className="btn-primary disabled:opacity-60">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  إرسال رمز التحقق
                </button>
              </>
            ) : (
              <>
                <label className="block text-xs font-semibold text-muted">رمز التحقق (4 أرقام)</label>
                <input
                  dir="ltr"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  maxLength={4}
                  className="input-field w-full rounded-xl px-3 py-2 outline-none focus:border-primary text-center tracking-[0.5em] font-mono"
                />
                <div className="flex gap-2">
                  <button onClick={confirmCode} disabled={busy} className="btn-primary disabled:opacity-60">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    تأكيد الربط
                  </button>
                  <button onClick={() => { setStep('phone'); setCode(''); setMsg(null); }} className="text-sm text-muted hover:text-foreground px-2">
                    تغيير الرقم
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {msg && (
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${msg.ok ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30' : 'text-red-400 bg-red-500/10 border border-red-500/30'}`}>
            {msg.ok ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {msg.text}
          </div>
        )}
      </div>
    </section>
  );
}

/* ═════════════════ الاشتراك: التواريخ الحقيقية ═════════════════ */

interface SubFull extends SubRow {
  id: string;
}

export function SubscriptionSection({ user }: { user: User }) {
  const [rows, setRows] = useState<SubFull[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('subscriptions')
        .select('id, plan_id, status, starts_at, expires_at')
        .eq('user_id', user.id)
        .order('starts_at', { ascending: false });
      if (!cancelled) setRows((data ?? []) as SubFull[]);
    })();
    return () => { cancelled = true; };
  }, [user.id]);

  if (rows === null) {
    return (
      <section className="card border border-dark-border rounded-2xl p-5 text-sm text-muted flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> جاري تحميل الاشتراك...
      </section>
    );
  }

  const ent = computeEntitlements(rows);
  const counted = rows.filter((r) => !['refunded', 'cancelled', 'pending', 'failed'].includes(r.status));
  // بداية أحدث اشتراك فعّال للأقسام، وأحدث اشتراك يمنح الذكاء.
  const sectionsRow = counted.find((r) => r.plan_id === 'chat_monthly' || r.plan_id === 'lifetime_access') ?? null;
  const aiRow = counted.find((r) => ['chat_monthly', 'lifetime_access', 'ai_refill'].includes(r.plan_id)) ?? null;
  const aiYearly = counted.some((r) => r.plan_id === 'lifetime_access' && ent.aiActive);

  return (
    <section className="card border border-dark-border rounded-2xl p-5">
      <h2 className="font-cairo font-bold text-lg mb-4 flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-primary-light" />
        الاشتراك
      </h2>

      {counted.length === 0 ? (
        <p className="text-sm text-muted mb-4">ليس لديك اشتراك مفعّل بعد.</p>
      ) : (
        <div className="space-y-3">
          <div className={`rounded-xl border p-4 ${ent.sectionsActive ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-dark-border'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-2 font-bold"><Layers className="w-4 h-4 text-primary-light" /> أقسام المنصة</span>
              <span className={`text-xs rounded-full px-2.5 py-0.5 font-bold ${ent.sectionsActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                {ent.sectionsActive ? `مفعّل · باقي ${daysLeft(ent.sectionsExpiresAt)} يوم` : 'منتهي'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted">
              <div>الباقة: <span className="text-foreground font-semibold">{sectionsRow ? PLAN_LABEL[sectionsRow.plan_id] ?? sectionsRow.plan_id : '—'}</span></div>
              <div>بدأ: <span className="text-foreground font-semibold">{fmt(sectionsRow?.starts_at)}</span></div>
              <div className="col-span-2">ينتهي: <span className="text-foreground font-semibold">{fmt(ent.sectionsExpiresAt)}</span></div>
            </div>
          </div>

          <div className={`rounded-xl border p-4 ${ent.aiActive ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-dark-border'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-2 font-bold"><Sparkles className="w-4 h-4 text-primary-light" /> الأستاذ ذكي</span>
              <span className={`text-xs rounded-full px-2.5 py-0.5 font-bold ${ent.aiActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                {ent.aiActive ? `مفعّل · باقي ${daysLeft(ent.aiExpiresAt)} يوم` : 'منتهي'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted">
              <div>النوع: <span className="text-foreground font-semibold">{aiYearly ? 'سنوي' : ent.aiActive ? 'شهري' : '—'}</span></div>
              <div>بدأ: <span className="text-foreground font-semibold">{fmt(aiRow?.starts_at)}</span></div>
              <div className="col-span-2">ينتهي: <span className="text-foreground font-semibold">{fmt(ent.aiExpiresAt)}</span></div>
            </div>
            {!ent.aiActive && ent.sectionsActive && (
              <p className="mt-2 text-xs text-amber-500">انتهى شهر الذكاء الاصطناعي وأقسامك ما زالت مفعّلة. اطلب كود إعادة التعبئة.</p>
            )}
          </div>
        </div>
      )}

      <Link
        href="/account/subscription"
        className="mt-4 inline-flex items-center justify-center w-full gap-2 rounded-xl px-4 py-2.5 text-sm font-bold bg-primary text-primary-foreground hover:opacity-90 transition"
      >
        إدارة الاشتراك / طلب كود
      </Link>
    </section>
  );
}
