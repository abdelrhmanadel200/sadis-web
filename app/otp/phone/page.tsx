'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';

/**
 * Phone OTP verification. Reached from /login after an SMS is sent via
 * /api/phone-otp/send. A 4-digit code is verified through
 * /api/phone-otp/verify, which returns Supabase session tokens we hand to
 * supabase.auth.setSession(). Then we bounce to `next`.
 */
function PhoneOtpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const phone = params.get('phone') || '';
  const rawNext = params.get('next') ?? '';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/chat';

  const [digits, setDigits] = useState<string[]>(Array(4).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(60);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!phone) router.replace('/login');
  }, [phone, router]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  const handleChange = (i: number, v: string) => {
    const cleaned = v.replace(/\D/g, '');
    if (cleaned.length > 1) {
      const arr = [...digits];
      let idx = i;
      for (const ch of cleaned) {
        if (idx > 3) break;
        arr[idx] = ch;
        idx++;
      }
      setDigits(arr);
      inputsRef.current[Math.min(idx, 3)]?.focus();
      if (arr.every((d) => d && d.length === 1)) verifyCode(arr.join(''));
      return;
    }
    const one = cleaned.slice(0, 1);
    const arr = [...digits];
    arr[i] = one;
    setDigits(arr);
    if (one && i < 3) inputsRef.current[i + 1]?.focus();
    if (one && i === 3 && arr.every((d) => d && d.length === 1)) {
      verifyCode(arr.join(''));
    }
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputsRef.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!text) return;
    e.preventDefault();
    const arr = text.split('');
    while (arr.length < 4) arr.push('');
    setDigits(arr);
    inputsRef.current[Math.min(text.length, 3)]?.focus();
    if (text.length === 4) verifyCode(text);
  };

  const verifyCode = async (code: string) => {
    setError(null);
    if (code.length < 4) {
      setError('أدخل الرمز المكوّن من 4 أرقام');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/phone-otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'الرمز غير صحيح');
        return;
      }
      // Establish the Supabase session from the returned tokens.
      const { error: sessErr } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessErr) {
        setError('تعذّر إنشاء الجلسة، حاول مرة ثانية');
        return;
      }
      if (next.startsWith('/api/')) {
        window.location.assign(next);
      } else {
        router.replace(next);
      }
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  const verify = () => verifyCode(digits.join(''));

  const resend = async () => {
    setError(null);
    try {
      const res = await fetch('/api/phone-otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'تعذّر إعادة الإرسال');
        return;
      }
      setResendIn(60);
    } catch {
      setError('تعذّر الاتصال بالخادم');
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
              <h1 className="font-cairo font-bold text-2xl">أدخل الرمز</h1>
              <p className="text-muted text-sm">
                أرسلنا رمزاً مكوّناً من 4 أرقام إلى <span dir="ltr">{phone}</span>
              </p>
            </div>
          </div>

          <div className="flex gap-3 justify-center mb-6" dir="ltr">
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
                className="input-field w-14 h-16 text-center rounded-xl text-2xl font-semibold focus:border-primary font-mulish"
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
              <button onClick={resend} className="text-primary-light font-semibold">
                إعادة إرسال الرمز
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function PhoneOtpPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-muted">
          جاري التحميل...
        </div>
      }
    >
      <PhoneOtpForm />
    </Suspense>
  );
}
