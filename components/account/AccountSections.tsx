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
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase, isEmbeddedMode } from '@/lib/supabase';
import { computeEntitlements, type SubRow } from '@/lib/entitlements';
import { toAsciiDigits } from '@/lib/iraq';
import {
  normalizePasswordInput,
  passwordRuleError,
  PASSWORD_MISMATCH_MESSAGE,
} from '@/lib/password-rules';

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';

const daysLeft = (iso: string | null) =>
  iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)) : 0;

/** الاسم الظاهر للطالب لكل باقة (لا نثق بأسماء القاعدة). */
const PLAN_LABEL: Record<string, string> = {
  chat_monthly: 'الباقة الأساسية (25 ألف)',
  lifetime_access: 'الباقة السنوية (250 ألف)',
  ai_refill: 'إعادة تعبئة الذكاء الاصطناعي',
};

/**
 * نفس تطبيع صفحة الدخول والسيرفر (lib/phone-otp.ts): أرقام عربية، 00 قبل مفتاح
 * الدولة، الصفر الزائد بعد 964، والأرقام المحلية العراقية إلى +964.
 * لو اختلف التطبيع لما طابق الرقمُ المربوط الدخولَ بالهاتف لاحقاً.
 */
function toE164(raw: string): string | null {
  let d = toAsciiDigits(raw).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('9640')) d = '964' + d.slice(4);
  if (d.length === 11 && d.startsWith('0')) d = '964' + d.slice(1);
  else if (/^7\d{9}$/.test(d)) d = '964' + d;
  if (!/^\d{10,15}$/.test(d) || d.startsWith('0')) return null;
  return '+' + d;
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
      // داخل التطبيق، التطبيق هو من يجدد الجلسة، ويكفي الرقم المحفوظ هنا.
      if (!isEmbeddedMode()) void supabase.auth.refreshSession();
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

/* ═════════════════ كلمة المرور ═════════════════ */

const PASSWORD_HINT =
  '8 أحرف على الأقل وفيها حرف ورقم. تقدر بعدها تدخل ببريدك أو رقمك مع كلمة المرور. نسيت كلمة المرور؟ ادخل برمز التحقق وغيرها من هنا.';

// نفس نافذة السيرفر: بعد الدخول برمز التحقق بدقائق لا تطلب كلمة المرور الحالية.
const OTP_FRESH_SECONDS = 10 * 60;
const OTP_AMR_METHODS = ['otp', 'magiclink', 'recovery'];

/** هل الجلسة من دخول برمز تحقق قبل دقائق؟ (قراءة amr من التوكن، للعرض فقط). */
function sessionFromRecentOtp(accessToken: string | undefined): boolean {
  try {
    const part = accessToken?.split('.')[1];
    if (!part) return false;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))) as { amr?: unknown };
    if (!Array.isArray(payload.amr)) return false;
    const now = Math.floor(Date.now() / 1000);
    return payload.amr.some((e: { method?: unknown; timestamp?: unknown } | null) =>
      !!e &&
      OTP_AMR_METHODS.includes(String(e.method)) &&
      typeof e.timestamp === 'number' &&
      now - e.timestamp <= OTP_FRESH_SECONDS - 30,
    );
  } catch {
    return false;
  }
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  autoComplete: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-muted mb-1">{label}</label>
      <input
        id={id}
        type={show ? 'text' : 'password'}
        dir="ltr"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="input-field w-full rounded-xl px-3 py-2 outline-none focus:border-primary"
      />
    </div>
  );
}

export function PasswordSection({ user }: { user: User }) {
  const markerFromUser = !!user.app_metadata?.password_set_at;
  const [hasPassword, setHasPassword] = useState(markerFromUser);
  // دخل برمز التحقق قبل قليل (نسيت كلمة المرور): لا نطلب الحالية.
  const [freshOtp, setFreshOtp] = useState(false);
  const [current, setCurrent] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const realEmail = user.email && !user.email.endsWith('@phone.sadisultra.local') ? user.email : null;
  const username = realEmail ?? (user.phone ? `+${user.phone.replace(/^\+/, '')}` : '');

  useEffect(() => {
    if (markerFromUser) setHasPassword(true);
  }, [markerFromUser]);

  // الجلسة المحفوظة قد تكون أقدم من كلمة مرور عينت من جهاز آخر.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!cancelled) setFreshOtp(sessionFromRecentOtp(session?.access_token));
        const { data } = await supabase.auth.getUser();
        if (!cancelled && data.user?.app_metadata?.password_set_at) setHasPassword(true);
      } catch {
        /* نكتفي بالجلسة المحلية، والسيرفر يصحح الحالة عند الحفظ */
      }
    })();
    return () => { cancelled = true; };
  }, [user.id]);

  const needCurrent = hasPassword && !freshOtp;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const ruleError = passwordRuleError(newPw);
    if (ruleError) {
      setMsg({ ok: false, text: ruleError });
      return;
    }
    if (normalizePasswordInput(newPw) !== normalizePasswordInput(confirmPw)) {
      setMsg({ ok: false, text: PASSWORD_MISMATCH_MESSAGE });
      return;
    }
    if (needCurrent && !current) {
      setMsg({ ok: false, text: 'ادخل كلمة المرور الحالية.' });
      return;
    }
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setMsg({ ok: false, text: 'انتهت الجلسة، سجل دخول مرة ثانية.' });
        return;
      }
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          new_password: newPw,
          ...(needCurrent ? { current_password: current } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        if (data.code === 'current_password_invalid') {
          // الحساب فيه كلمة مرور (أو انتهت دقائق رمز التحقق): اطلب الحالية.
          setHasPassword(true);
          setFreshOtp(false);
        }
        setMsg({ ok: false, text: data.message || 'تعذر حفظ كلمة المرور، حاول مرة ثانية.' });
        return;
      }

      let text = 'تم حفظ كلمة المرور. تقدر تدخل الآن ببريدك أو رقمك مع كلمة المرور.';
      const s = data.session as { access_token?: string; refresh_token?: string } | undefined;
      if (s?.access_token && s.refresh_token) {
        // بديل نادر: السيرفر ألغى الجلسات وأرسل جلسة جديدة.
        const { error } = await supabase.auth.setSession({
          access_token: s.access_token,
          refresh_token: s.refresh_token,
        });
        if (error) text = 'تم حفظ كلمة المرور. سجل دخول من جديد بكلمة المرور.';
      } else if (data.relogin) {
        text = 'تم حفظ كلمة المرور. سجل دخول من جديد بكلمة المرور.';
      } else if (!isEmbeddedMode()) {
        // حتى تصل علامة كلمة المرور لبيانات الجلسة. داخل التطبيق، التطبيق يجدد.
        void supabase.auth.refreshSession();
      }

      setHasPassword(true);
      setFreshOtp(false);
      setCurrent('');
      setNewPw('');
      setConfirmPw('');
      setShow(false);
      setMsg({ ok: true, text });
    } catch {
      setMsg({ ok: false, text: 'تعذر الاتصال بالخادم.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card border border-dark-border rounded-2xl p-5">
      <h2 className="font-cairo font-bold text-lg mb-2 flex items-center gap-2">
        <KeyRound className="w-5 h-5 text-primary-light" />
        {hasPassword ? 'تغيير كلمة المرور' : 'تعيين كلمة المرور'}
      </h2>
      <p className="text-xs text-muted leading-relaxed mb-4">{PASSWORD_HINT}</p>

      <form onSubmit={submit} className="space-y-3">
        {/* لمديري كلمات المرور في المتصفح */}
        <input type="text" name="username" autoComplete="username" value={username} readOnly hidden />

        {needCurrent && (
          <PasswordField
            id="pw-current"
            label="كلمة المرور الحالية"
            value={current}
            onChange={setCurrent}
            show={show}
            autoComplete="current-password"
          />
        )}
        {hasPassword && freshOtp && (
          <p className="text-xs rounded-lg px-3 py-2 bg-primary/10 border border-primary/30">
            دخلت برمز التحقق قبل قليل، فتقدر تعين كلمة مرور جديدة بدون الحالية.
          </p>
        )}
        <PasswordField
          id="pw-new"
          label="كلمة المرور الجديدة"
          value={newPw}
          onChange={setNewPw}
          show={show}
          autoComplete="new-password"
        />
        <PasswordField
          id="pw-confirm"
          label="تأكيد كلمة المرور الجديدة"
          value={confirmPw}
          onChange={setConfirmPw}
          show={show}
          autoComplete="new-password"
        />

        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
        </button>

        {msg && (
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${msg.ok ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30' : 'text-red-400 bg-red-500/10 border border-red-500/30'}`}>
            {msg.ok ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {msg.text}
          </div>
        )}

        <div>
          <button type="submit" disabled={busy} className="btn-primary disabled:opacity-60">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            حفظ كلمة المرور
          </button>
        </div>
      </form>
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
  const hasSections = !!ent.sectionsPlanId;
  const hasAi = !!ent.aiPlanId;
  // النوع حسب الباقة التي تعطي أبعد نهاية للذكاء (السنوية = سنوي، حتى بعد انتهائها).
  const aiYearly = ent.aiActive ? ent.aiYearly : ent.aiPlanId === 'lifetime_access';

  const badge = (active: boolean, known: boolean, end: string | null) =>
    active ? `مفعّل · باقي ${daysLeft(end)} يوم` : known ? 'منتهي' : 'غير مفعل';

  return (
    <section className="card border border-dark-border rounded-2xl p-5">
      <h2 className="font-cairo font-bold text-lg mb-4 flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-primary-light" />
        الاشتراك
      </h2>

      {!ent.hasHistory ? (
        <p className="text-sm text-muted mb-4">ليس لديك اشتراك مفعّل بعد.</p>
      ) : (
        <div className="space-y-3">
          <div className={`rounded-xl border p-4 ${ent.sectionsActive ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-dark-border'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-2 font-bold"><Layers className="w-4 h-4 text-primary-light" /> أقسام المنصة</span>
              <span className={`text-xs rounded-full px-2.5 py-0.5 font-bold ${ent.sectionsActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                {badge(ent.sectionsActive, hasSections, ent.sectionsExpiresAt)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted">
              <div>الباقة: <span className="text-foreground font-semibold">{ent.sectionsPlanId ? PLAN_LABEL[ent.sectionsPlanId] ?? ent.sectionsPlanId : '-'}</span></div>
              <div>بدأ: <span className="text-foreground font-semibold">{fmt(ent.sectionsStartsAt)}</span></div>
              <div className="col-span-2">
                {ent.sectionsActive ? 'ينتهي: ' : 'انتهى في: '}
                <span className="text-foreground font-semibold">
                  {fmt(ent.sectionsActive ? ent.sectionsExpiresAt : ent.lastSectionsExpiresAt)}
                </span>
              </div>
            </div>
          </div>

          <div className={`rounded-xl border p-4 ${ent.aiActive ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-dark-border'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-2 font-bold"><Sparkles className="w-4 h-4 text-primary-light" /> الأستاذ ذكي</span>
              <span className={`text-xs rounded-full px-2.5 py-0.5 font-bold ${ent.aiActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                {badge(ent.aiActive, hasAi, ent.aiExpiresAt)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted">
              <div>النوع: <span className="text-foreground font-semibold">{hasAi ? (aiYearly ? 'سنوي' : 'شهري') : '-'}</span></div>
              <div>بدأ: <span className="text-foreground font-semibold">{fmt(ent.aiStartsAt)}</span></div>
              <div className="col-span-2">
                {ent.aiActive ? 'ينتهي: ' : 'انتهى في: '}
                <span className="text-foreground font-semibold">
                  {fmt(ent.aiActive ? ent.aiExpiresAt : ent.lastAiExpiresAt)}
                </span>
              </div>
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
