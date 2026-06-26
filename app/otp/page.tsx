'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';

function OtpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get('email') || '';
  const mode = params.get('mode');
  // Same-origin-only next URL forwarded from /login.
  const rawNext = params.get('next') ?? '';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/chat';

  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(30);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!email) router.replace('/login');
  }, [email, router]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    // Autofocus first input
    inputsRef.current[0]?.focus();
  }, []);

  const handleChange = (i: number, v: string) => {
    const cleaned = v.replace(/\D/g, '').slice(0, 1);
    const next = [...digits];
    next[i] = cleaned;
    setDigits(next);
    if (cleaned && i < 5) inputsRef.current[i + 1]?.focus();
    // Auto-submit when the 6th digit is entered
    if (cleaned && i === 5 && next.every((d) => d && d.length === 1)) {
      verifyCode(next.join(''));
    }
  };

  const handleKeyDown = (
    i: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputsRef.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = text.split('');
    while (next.length < 6) next.push('');
    setDigits(next);
    const focusIdx = Math.min(text.length, 5);
    inputsRef.current[focusIdx]?.focus();
    // Auto-submit on full 6-digit paste
    if (text.length === 6) {
      verifyCode(text);
    }
  };

  const verifyCode = async (code: string) => {
    setError(null);
    if (code.length < 6) {
      setError('أدخل الكود المكوّن من 6 أرقام');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email',
      });
      if (error) throw error;

      // On register, save name into profiles
      if (mode === 'register' && typeof window !== 'undefined') {
        const pendingName = sessionStorage.getItem('pending-profile-name');
        if (pendingName && data.user) {
          await supabase
            .from('profiles')
            .update({ name: pendingName })
            .eq('id', data.user.id);
          sessionStorage.removeItem('pending-profile-name');
        }
      }

      // If next points to /api/sso/discourse we MUST hard-navigate so the
      // server sees our session cookies; client-side router.replace keeps the
      // request in the SPA and skips the SSO redirect chain.
      if (next.startsWith('/api/')) {
        window.location.assign(next);
      } else {
        router.replace(next);
      }
    } catch (err: any) {
      setError(err?.message || 'الكود غير صحيح');
    } finally {
      setLoading(false);
    }
  };

  const verify = () => verifyCode(digits.join(''));

  const resend = async () => {
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo:
            typeof window !== 'undefined'
              ? `${window.location.origin}/chat`
              : undefined,
        },
      });
      if (error) throw error;
      setResendIn(30);
    } catch (err: any) {
      setError(err?.message || 'تعذّر إعادة الإرسال');
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-muted hover:opacity-80"
          >
            <ArrowLeft className="w-4 h-4 rotate-180" />
            رجوع
          </Link>
        </div>

        <div className="card rounded-3xl p-8 border border-dark-border">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-cairo font-bold text-2xl">أدخل الكود</h1>
              <p className="text-muted text-sm">
                أرسلنا كود 6 أرقام إلى <span dir="ltr">{email}</span>
              </p>
            </div>
          </div>

          <div className="flex gap-2 justify-center mb-6" dir="ltr">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputsRef.current[i] = el;
                }}
                value={d}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={handlePaste}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                className="input-field w-12 h-14 text-center rounded-xl text-xl font-semibold focus:border-primary font-mulish"
              />
            ))}
          </div>

          {error && (
            <div className="text-error text-sm bg-error/10 border border-error/30 rounded-lg px-3 py-2 mb-4">
              {error}
            </div>
          )}

          <button
            onClick={verify}
            disabled={loading}
            className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'جاري التحقق...' : 'تحقّق'}
          </button>

          <div className="mt-5 text-center text-sm text-muted">
            {resendIn > 0 ? (
              <>يمكن إعادة الإرسال خلال {resendIn} ثانية</>
            ) : (
              <button
                onClick={resend}
                className="text-primary-light font-semibold"
              >
                إعادة إرسال الكود
              </button>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-muted leading-relaxed">
            أو افتح الرابط المرسل لبريدك مباشرة لتسجيل الدخول
          </p>
        </div>
      </div>
    </main>
  );
}

export default function OtpPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-muted">
          جاري التحميل...
        </div>
      }
    >
      <OtpForm />
    </Suspense>
  );
}
