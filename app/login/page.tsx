'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Phone, ArrowLeft, Sparkles, Lock, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toAsciiDigits } from '@/lib/iraq';

/**
 * Login screen. Two identifiers (email / phone), each with two modes:
 *   - Code:     Email → Supabase email OTP → /otp?email=...
 *               Phone → OTPIQ SMS via /api/phone-otp/send → /otp/phone?phone=...
 *   - Password: /api/auth/password-login → supabase.auth.setSession()
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
type Mode = 'code' | 'password';

/** Same-origin path only. Browsers read `/\evil.com` and `/<tab>/evil.com`
 *  as `//evil.com`, so a prefix check is not enough: resolve it and compare
 *  the origin (fixed base, so it also works during prerender). */
function safeNext(raw: string): string {
  if (!/^\/(?![\/\\])/.test(raw)) return '/chat';
  try {
    return new URL(raw, 'http://same.invalid').origin === 'http://same.invalid' ? raw : '/chat';
  } catch {
    return '/chat';
  }
}

/**
 * الرقم بصيغة +<أرقام> أو null. نفس قواعد السيرفر (lib/phone-otp.ts):
 * أرقام عربية، 00 قبل مفتاح الدولة، الصفر الزائد بعد 964، 07XXXXXXXXX و 7XXXXXXXXX.
 */
function normalizePhone(raw: string): string | null {
  let d = toAsciiDigits(raw).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('9640')) d = '964' + d.slice(4);
  if (d.length === 11 && d.startsWith('0')) d = '964' + d.slice(1);
  else if (/^7\d{9}$/.test(d)) d = '964' + d;
  if (!/^\d{10,15}$/.test(d) || d.startsWith('0')) return null;
  return '+' + d;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [method, setMethod] = useState<Method>('email');
  const [mode, setMode] = useState<Mode>('code');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  // نسيت كلمة المرور: بعد الدخول بالرمز نفتح قسم كلمة المرور في حسابي.
  const [resetFlow, setResetFlow] = useState(false);

  // Sanitise `next` so it can only point inside our site (open-redirect safety).
  const next = safeNext(searchParams.get('next') ?? '');
  const codeNext = resetFlow && next === '/chat' ? '/profile#security' : next;

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

  const goNext = () => {
    // /api/sso/... needs a full page load so the server sees the session.
    if (next.startsWith('/api/')) {
      window.location.assign(next);
    } else {
      router.replace(next);
    }
  };

  const readEmail = (): string | null => {
    const value = email.trim().toLowerCase();
    if (!value) {
      setError('أدخل البريد الإلكتروني');
      return null;
    }
    if (!EMAIL_RE.test(value)) {
      setError('صيغة البريد الإلكتروني غير صحيحة');
      return null;
    }
    return value;
  };

  const readPhone = (): string | null => {
    const e164 = normalizePhone(phone);
    if (!e164) setError('أدخل رقم هاتف صحيح (مثال: 07701234567)');
    return e164;
  };

  const submitEmail = async () => {
    const value = readEmail();
    if (!value) return;
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
        `/otp?email=${encodeURIComponent(value)}&next=${encodeURIComponent(codeNext)}`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      setError(msg || 'تعذّر إرسال الكود، حاول مرة ثانية');
    } finally {
      setLoading(false);
    }
  };

  const submitPhone = async () => {
    const e164 = readPhone();
    if (!e164) return;
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
        `/otp/phone?phone=${encodeURIComponent(e164)}&next=${encodeURIComponent(codeNext)}`,
      );
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  const submitPassword = async () => {
    const payload: { email?: string; phone?: string; password: string } = { password };
    if (method === 'email') {
      const value = readEmail();
      if (!value) return;
      payload.email = value;
    } else {
      const e164 = readPhone();
      if (!e164) return;
      payload.phone = e164;
    }
    if (!password) {
      setError('أدخل كلمة المرور');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/password-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.access_token || !data.refresh_token) {
        setError(data.message || 'تعذر تسجيل الدخول، حاول مرة ثانية');
        return;
      }
      const { error: sessErr } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessErr) {
        setError('تعذر إنشاء الجلسة، حاول مرة ثانية');
        return;
      }
      setPassword('');
      goNext();
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === 'password') void submitPassword();
    else if (method === 'email') void submitEmail();
    else void submitPhone();
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    if (m === 'password') {
      setHint(null);
      setResetFlow(false);
    } else {
      setPassword('');
      setShowPw(false);
    }
  };

  const forgotPassword = () => {
    switchMode('code');
    setResetFlow(true);
    setHint('ادخل برمز التحقق ثم غير كلمة المرور من صفحة حسابي');
  };

  const subtitle =
    mode === 'password'
      ? method === 'email'
        ? 'ادخل بريدك الإلكتروني وكلمة المرور'
        : 'ادخل رقم هاتفك وكلمة المرور'
      : method === 'email'
        ? 'سنرسل لك رمز تفعيل على بريدك الإلكتروني'
        : 'سنرسل لك رمز تفعيل عبر رسالة نصية';

  const submitLabel =
    mode === 'password'
      ? loading ? 'جاري الدخول...' : 'دخول'
      : loading ? 'جاري إرسال الرمز...' : 'أرسل رمز الدخول';

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
              <p className="text-muted text-sm">{subtitle}</p>
            </div>
          </div>

          {/* Method toggle */}
          <div className="grid grid-cols-2 gap-2 mb-3 p-1 rounded-xl bg-card/40 border border-dark-border">
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

          {/* Mode switch: رمز التحقق أو كلمة المرور */}
          <div className="flex items-center justify-center gap-2 mb-5">
            {(
              [
                { v: 'code', l: 'الدخول برمز التحقق' },
                { v: 'password', l: 'الدخول بكلمة المرور' },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                aria-pressed={mode === o.v}
                onClick={() => switchMode(o.v)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition ${
                  mode === o.v
                    ? 'border-primary bg-primary/10 text-primary-light'
                    : 'border-dark-border text-muted hover:opacity-80'
                }`}
              >
                {o.l}
              </button>
            ))}
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
                    autoComplete={mode === 'password' ? 'username' : 'email'}
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
                    autoComplete={mode === 'password' ? 'username' : 'tel'}
                    className="input-field w-full rounded-xl ps-12 pe-4 py-3 outline-none focus:border-primary"
                  />
                </div>
                <p className="text-xs text-muted mt-1.5">
                  أدخل رقمك العراقي بأي صيغة، مثال: 07701234567
                </p>
              </div>
            )}

            {mode === 'password' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="login-password" className="text-sm font-medium">
                    كلمة المرور
                  </label>
                  <button
                    type="button"
                    onClick={forgotPassword}
                    className="text-xs font-semibold text-primary-light hover:underline"
                  >
                    نسيت كلمة المرور؟
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-5 h-5 absolute top-1/2 -translate-y-1/2 right-4 text-muted pointer-events-none" />
                  <input
                    id="login-password"
                    type={showPw ? 'text' : 'password'}
                    dir="ltr"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="input-field w-full rounded-xl px-12 py-3 outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    className="absolute top-1/2 -translate-y-1/2 left-3 p-1 text-muted hover:opacity-80"
                  >
                    {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            {hint && mode === 'code' && (
              <div className="text-sm bg-primary/10 border border-primary/30 rounded-lg px-3 py-2">
                {hint}
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
              {submitLabel}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-muted">
            أليس لديك حساب؟{' '}
            <Link
              href={next === '/chat' ? '/register' : `/register?next=${encodeURIComponent(next)}`}
              className="text-primary-light font-semibold"
            >
              سجّل الآن
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
