'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, MapPin, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/providers/AuthProvider';

const GOVERNORATES = [
  'بغداد', 'البصرة', 'نينوى', 'أربيل', 'النجف', 'كربلاء', 'بابل',
  'ذي قار', 'الأنبار', 'ديالى', 'كركوك', 'واسط', 'صلاح الدين',
  'القادسية', 'المثنى', 'ميسان', 'دهوك', 'السليمانية', 'حلبجة',
];

// أنواع الأكواد الثلاثة — يطلب الطالب أيّاً منها ويسلّمه فريق التفعيل الكود.
const PLANS = [
  { id: 'chat_monthly', label: 'كود تشغيل أقسام الموقع + شهر ذكاء اصطناعي' },
  { id: 'ai_refill', label: 'كود إعادة تعبئة الذكاء الاصطناعي (شهر)' },
  { id: 'lifetime_access', label: 'كود تشغيل الذكاء الاصطناعي سنة كاملة' },
];

// Iraqi-aware phone normalizer (matches login/page.tsx).
function normalizePhone(raw: string): string | null {
  let p = raw.replace(/[\s\-()]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (p.startsWith('+')) return /^\+\d{8,15}$/.test(p) ? p : null;
  if (p.startsWith('0')) p = p.slice(1);
  if (/^\d{9,10}$/.test(p)) return '+964' + p;
  return null;
}

export default function ActivationRequestPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [governorate, setGovernorate] = useState('بغداد');
  const [area, setArea] = useState('');
  const [phone, setPhone] = useState('');
  const [planId, setPlanId] = useState('chat_monthly');

  // Preselect the code type when arriving from a plan card
  // (e.g. /activation-request?plan=lifetime_access). Read from
  // window.location to avoid a useSearchParams Suspense boundary.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('plan');
    if (p && PLANS.some((x) => x.id === p)) setPlanId(p);
  }, []);
  const [refCode, setRefCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // Non-blocking notice when the optional marketer code was rejected.
  const [refNotice, setRefNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  // Prefill name/phone from the profile if available.
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('name, phone')
        .eq('id', user.id)
        .maybeSingle();
      if (data?.name) setFullName((v) => v || (data.name as string));
      if (data?.phone) setPhone((v) => v || (data.phone as string));
    })();
  }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!user) {
      setError('سجّل دخولك أولاً.');
      return;
    }
    const name = fullName.trim();
    const ar = area.trim();
    if (!name) return setError('أدخل اسمك الكامل.');
    if (!ar) return setError('أدخل المنطقة.');
    const normalized = normalizePhone(phone);
    if (!normalized) return setError('أدخل رقم هاتف صحيح.');

    setBusy(true);
    try {
      const { error: insErr } = await supabase.from('subscription_requests').insert({
        user_id: user.id,
        full_name: name.slice(0, 120),
        governorate,
        area: ar.slice(0, 120),
        phone: normalized,
        plan_id: planId,
        status: 'pending',
      });
      if (insErr) throw insErr;
      // Best-effort referral attribution (affiliate system) — the RPC enforces
      // all rules (first-wins, no self-referral, no existing subscribers) and
      // returns a boolean verdict. A rejected code must not block the request,
      // but the student deserves to know it didn't count.
      const code = refCode.trim();
      if (code) {
        try {
          const { data: accepted, error: refErr } = await supabase.rpc('record_referral', {
            p_code: code,
            p_source: 'code',
          });
          if (refErr || accepted !== true) {
            setRefNotice(
              'ملاحظة: كود المسوّق لم يُقبل (غير صالح أو سبق ربط حسابك) — تم إرسال طلبك بشكل طبيعي بدونه.',
            );
          }
        } catch {
          setRefNotice('ملاحظة: تعذّر التحقق من كود المسوّق — تم إرسال طلبك بشكل طبيعي.');
        }
      }
      setDone(true);
    } catch {
      setError('تعذّر إرسال الطلب، حاول مرة ثانية.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground" dir="rtl">
      <div className="max-w-xl mx-auto px-5 py-10">
        <Link
          href="/account/subscription"
          className="inline-flex items-center gap-2 text-sm text-muted hover:opacity-80 mb-6"
        >
          <ArrowRight className="w-4 h-4" />
          العودة
        </Link>

        {done ? (
          <div className="text-center py-16">
            <div className="mx-auto w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold mb-3">تم استلام طلبك</h1>
            <p className="text-muted leading-relaxed mb-6">
              سيتواصل معك فريق التفعيل على رقمك لتسليمك رمز التفعيل. شكراً لك.
            </p>
            {refNotice && (
              <p className="text-sm text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2.5 mb-6">
                {refNotice}
              </p>
            )}
            <Link
              href="/account/subscription"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-bold bg-primary text-primary-foreground hover:opacity-90 transition"
            >
              العودة لصفحة الاشتراك
            </Link>
          </div>
        ) : (
          <>
            <header className="mb-6">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mb-4">
                <MapPin className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold mb-2 text-center">إرسال كود التفعيل لعنواني</h1>
              <p className="text-muted text-center leading-relaxed">
                املأ بياناتك ليتواصل معك فريق التفعيل ويسلّمك رمز التفعيل.
              </p>
            </header>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5">الاسم الكامل</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card/40 px-4 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5">المحافظة</label>
                  <select
                    value={governorate}
                    onChange={(e) => setGovernorate(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card/40 px-4 py-2.5 text-sm outline-none focus:border-primary"
                  >
                    {GOVERNORATES.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">المنطقة</label>
                  <input
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="اسم المنطقة / أقرب نقطة دالة"
                    className="w-full rounded-xl border border-border bg-card/40 px-4 py-2.5 text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5">رقم الهاتف</label>
                <input
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07XXXXXXXXX"
                  className="w-full rounded-xl border border-border bg-card/40 px-4 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5">نوع الكود المطلوب</label>
                <select
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card/40 px-4 py-2.5 text-sm outline-none focus:border-primary"
                >
                  {PLANS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5">
                  كود المسوّق (اختياري)
                </label>
                <input
                  dir="ltr"
                  value={refCode}
                  onChange={(e) => setRefCode(e.target.value)}
                  placeholder="إذا رشّحك أحد المسوّقين، اكتب كوده هنا"
                  className="w-full rounded-xl border border-border bg-card/40 px-4 py-2.5 text-sm outline-none focus:border-primary font-mono"
                />
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-primary text-primary-foreground font-bold px-5 py-3 text-sm hover:opacity-90 disabled:opacity-50"
              >
                {busy ? 'جاري الإرسال...' : 'إرسال الطلب'}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
