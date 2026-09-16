'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, MapPin, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/providers/AuthProvider';
import { GOVERNORATES, normalizeIraqPhone } from '@/lib/iraq';

// أنواع الأكواد الثلاثة، يطلب الطالب أيا منها ويسلمه فريق التفعيل الكود.
const PLANS = [
  { id: 'chat_monthly', label: 'الباقة الأساسية 25 ألف: كل الأقسام سنة + الأستاذ ذكي شهر' },
  { id: 'lifetime_access', label: 'الباقة السنوية 250 ألف: كل الأقسام والأستاذ ذكي سنة' },
  { id: 'ai_refill', label: 'إعادة تعبئة الأستاذ ذكي شهر' },
];

// رقم الملف الشخصي محفوظ بدون + (مثل 9647701234567)، يعرض بالصيغة المحلية 07...
function toLocalPhone(raw: string | null | undefined): string {
  const e164 = normalizeIraqPhone(raw);
  return e164 ? '0' + e164.slice(4) : (raw ?? '');
}

export default function ActivationRequestPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [governorate, setGovernorate] = useState<string>('بغداد');
  const [area, setArea] = useState('');
  const [phone, setPhone] = useState('');
  const [planId, setPlanId] = useState('chat_monthly');
  // مصدر الطلب: التطبيق يفتح الصفحة بـ ?src=app
  const [source, setSource] = useState<'web' | 'app'>('web');

  // نوع الكود من بطاقة الباقة (?plan=lifetime_access) ومصدر الطلب.
  // القراءة من window.location لتجنب حاجة useSearchParams إلى Suspense.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('plan');
    if (p && PLANS.some((x) => x.id === p)) setPlanId(p);
    if (params.get('src') === 'app') setSource('app');
  }, []);
  const [refCode, setRefCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // تنبيه غير مانع إذا رفض كود المسوق الاختياري.
  const [refNotice, setRefNotice] = useState<string | null>(null);

  useEffect(() => {
    // يرجع لنفس الصفحة بنفس الباقة والمصدر بعد الدخول، بدل الدردشة.
    if (!authLoading && !user) {
      router.replace('/login?next=' + encodeURIComponent(window.location.pathname + window.location.search));
    }
  }, [authLoading, user, router]);

  // تعبئة الاسم والرقم من الملف الشخصي أو من رقم حساب الدخول.
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('name, phone')
        .eq('id', user.id)
        .maybeSingle();
      if (data?.name) setFullName((v) => v || (data.name as string));
      const rawPhone = (data?.phone as string | null | undefined) || user.phone || '';
      if (rawPhone) setPhone((v) => v || toLocalPhone(rawPhone));
    })();
  }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!user) {
      setError('سجل دخولك أولا.');
      return;
    }
    const name = fullName.trim();
    const ar = area.trim();
    if (!name) return setError('أدخل اسمك الكامل.');
    if (!ar) return setError('أدخل المنطقة.');
    const normalized = normalizeIraqPhone(phone);
    if (!normalized) return setError('أدخل رقم موبايل عراقي صحيح، مثل 07701234567.');

    setBusy(true);
    try {
      // بدون select: الطالب لا يقرأ جدول الطلبات، والطلب المكرر لنفس النوع
      // يدمج مع الطلب المفتوح بدون خطأ.
      const { error: insErr } = await supabase.from('subscription_requests').insert({
        user_id: user.id,
        full_name: name.slice(0, 120),
        governorate,
        area: ar.slice(0, 120),
        phone: normalized,
        plan_id: planId,
        status: 'pending',
        source,
      });
      if (insErr) {
        console.error('subscription_requests insert', insErr);
        if (insErr.code === '23505') {
          setError('لديك طلب قيد المراجعة لنفس نوع الكود، سيتواصل معك فريق التفعيل.');
        } else if (/[ء-ي]/.test(insErr.message || '')) {
          setError(insErr.message);
        } else {
          setError('تعذر إرسال الطلب، حاول مرة ثانية.');
        }
        return;
      }
      // ربط المسوق (اختياري): الدالة تطبق كل الشروط (أول ربط فقط، لا ربط ذاتي،
      // لا مشتركين سابقين). رفض الكود لا يوقف الطلب لكن نخبر الطالب.
      const code = refCode.trim();
      if (code) {
        try {
          const { data: accepted, error: refErr } = await supabase.rpc('record_referral', {
            p_code: code,
            p_source: 'code',
          });
          if (refErr || accepted !== true) {
            setRefNotice(
              'ملاحظة: كود المسوق لم يقبل (غير صالح أو سبق ربط حسابك). تم إرسال طلبك بشكل طبيعي بدونه.',
            );
          }
        } catch {
          setRefNotice('ملاحظة: تعذر التحقق من كود المسوق. تم إرسال طلبك بشكل طبيعي.');
        }
      }
      setDone(true);
    } catch (err) {
      console.error(err);
      setError('تعذر إرسال الطلب، حاول مرة ثانية.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground" dir="rtl">
      <div className="max-w-xl mx-auto px-4 sm:px-5 py-10">
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
            <h1 className="text-2xl font-bold mb-3">تم إرسال طلب التفعيل</h1>
            <p className="text-muted leading-relaxed mb-6">
              تم استلام طلبك، سيتواصل معك فريق التفعيل على رقمك. إذا كان عندك طلب سابق لنفس النوع حدثنا بياناته.
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
              متابعة طلباتي في صفحة الاشتراك
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
                املأ بياناتك ليتواصل معك فريق التفعيل ويسلمك رمز التفعيل.
              </p>
            </header>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5">الاسم الكامل</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
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
                <label className="block text-sm font-semibold mb-1.5">رقم الموبايل</label>
                <input
                  dir="ltr"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07XXXXXXXXX"
                  className="w-full rounded-xl border border-border bg-card/40 px-4 py-2.5 text-sm text-left outline-none focus:border-primary"
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
                  كود المسوق (اختياري)
                </label>
                <input
                  dir="ltr"
                  value={refCode}
                  onChange={(e) => setRefCode(e.target.value)}
                  autoComplete="off"
                  placeholder="إذا رشحك أحد المسوقين، اكتب كوده هنا"
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
