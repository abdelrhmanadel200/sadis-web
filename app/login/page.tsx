'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Phone, ArrowLeft, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';

/**
 * Login screen. Two methods:
 *   - Email  → Supabase email OTP → /otp?email=...
 *   - Phone  → OTPIQ SMS via /api/phone-otp/send → /otp/phone?phone=...
 *
 * Honors a `?next=<path>` query param so callers (e.g. the Discourse SSO
 * endpoint) can bounce the user here and back after login.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

type Method = 'email' | 'phone';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [method, setMethod] = useState<Method>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sanitise `next` so it can only point inside our site (open-redirect safety).
  const rawNext = searchParams.get('next') ?? '';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/chat';

  // If we're already logged in, skip the form.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!cancelled && data.session) {
        router.replace(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [next, router]);

  /** Normalise an Iraqi phone number to E.164 (+964...). Accepts
   *  0770..., 770..., +964770..., 00964770... */
  function normalizePhone(raw: string): string | null {
    let p = raw.replace(/[\s\-()]/g, '');
    if (p.startsWith('00')) p = '+' + p.slice(2);
    if (p.startsWith('+')) {
      return /^\+\d{8,15}$/.test(p) ? p : null;
    }
    // Local Iraqi formats.
    if (p.startsWith('0')) p = p.slice(1);
    if (/^\d{9,10}$/.test(p)) return '+964' + p;
    return null;
  }

  const submitEmail = async () => {
    const value = email.trim().toLowerCase();
    if (!value) {
      setError('أدخل البريد الإلكتروني');
      return;
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(value)) {
      setError('صيغة البريد الإلكتروني غير صحيحة');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: value,
        options: {
          shouldCreateUser: true,
          emailRedirectTo:
            typeof window !== 'undefined'
              ? `${window.location.origin}${next}`
              : undefined,
        },
      });
      if (error) throw error;
      router.push(
        `/otp?email=${encodeURIComponent(value)}&next=${encodeURIComponent(next)}`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      setError(msg || 'تعذّر إرسال الكود، حاول مرة ثانية');
    } finally {
      setLoading(false);
    }
  };

  const submitPhone = async () => {
    const e164 = normalizePhone(phone);
    if (!e164) {
      setError('أدخل رقم هاتف صحيح (مثال: 07701234567)');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/phone-otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: e164 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'تعذّر إرسال الرمز، حاول مرة ثانية');
        return;
      }
      router.push(
        `/otp/phone?phone=${encodeURIComponent(e164)}&next=${encodeURIComponent(next)}`,
      );
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (method === 'email') void submitEmail();
    else void submitPhone();
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-muted hover:opacity-80"
          >
            <ArrowLeft className="w-4 h-4 rotate-180" />
            الرئيسية
          </Link>
        </div>

        <div className="card rounded-3xl p-8 border border-dark-border">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-cairo font-bold text-2xl">تسجيل الدخول</h1>
              <p className="text-muted text-sm">
                {method === 'email'
                  ? 'سنرسل لك رمز تفعيل على بريدك الإلكتروني'
                  : 'سنرسل لك رمز تفعيل عبر رسالة نصية'}
              </p>
            </div>
          </div>

          {/* Method toggle */}
          <div className="grid grid-cols-2 gap-2 mb-5 p-1 rounded-xl bg-card/40 border border-dark-border">
            <button
              type="button"
              onClick={() => { setMethod('email'); setError(null); }}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition ${
                method === 'email' ? 'bg-primary text-white' : 'text-muted'
              }`}
            >
              <Mail className="w-4 h-4" /> البريد الإلكتروني
            </button>
            <button
              type="button"
              onClick={() => { setMethod('phone'); setError(null); }}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition ${
                method === 'phone' ? 'bg-primary text-white' : 'text-muted'
              }`}
            >
              <Phone className="w-4 h-4" /> رقم الهاتف
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {method === 'email' ? (
              <div>
                <label className="text-sm font-medium block mb-2">
                  البريد الإلكتروني
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 absolute top-1/2 -translate-y-1/2 start-4 text-muted" />
                  <input
                    type="email"
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="input-field w-full rounded-xl ps-12 pe-4 py-3 outline-none focus:border-primary"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium block mb-2">
                  رقم الهاتف
                </label>
                <div className="relative">
                  <Phone className="w-5 h-5 absolute top-1/2 -translate-y-1/2 start-4 text-muted" />
                  <input
                    type="tel"
                    dir="ltr"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="07701234567"
                    autoComplete="tel"
                    className="input-field w-full rounded-xl ps-12 pe-4 py-3 outline-none focus:border-primary"
                  />
                </div>
                <p className="text-xs text-muted mt-1.5">
                  أدخل رقمك العراقي بأي صيغة، مثال: 07701234567
                </p>
              </div>
            )}

            {error && (
              <div className="text-error text-sm bg-error/10 border border-error/30 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'جاري إرسال الرمز...' : 'أرسل رمز الدخول'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-muted">
            أليس لديك حساب؟{' '}
            <Link href="/register" className="text-primary-light font-semibold">
              سجّل الآن
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
