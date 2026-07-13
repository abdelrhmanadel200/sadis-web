'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, User, ArrowLeft, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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
          data: { name: name || null },
          emailRedirectTo:
            typeof window !== 'undefined'
              ? `${window.location.origin}/chat`
              : undefined,
        },
      });
      if (error) throw error;
      if (typeof window !== 'undefined' && name) {
        sessionStorage.setItem('pending-profile-name', name);
      }
      router.push(`/otp?email=${encodeURIComponent(value)}&mode=register`);
    } catch (err: any) {
      setError(err?.message || 'تعذّر إرسال الكود، حاول مرة ثانية');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-8">
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
              <h1 className="font-cairo font-bold text-2xl">إنشاء حساب</h1>
              <p className="text-muted text-sm">
                كن جاهزاً للدراسة مع الأستاذ ذكي
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-2">الاسم</label>
              <div className="relative">
                <User className="w-5 h-5 absolute top-1/2 -translate-y-1/2 start-4 text-muted" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="اسمك الكامل"
                  autoComplete="name"
                  className="input-field w-full rounded-xl ps-12 pe-4 py-3 outline-none focus:border-primary"
                />
              </div>
            </div>
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
              {loading ? 'جاري إرسال الكود...' : 'إنشاء الحساب'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-muted">
            عندك حساب؟{' '}
            <Link href="/login" className="text-primary-light font-semibold">
              سجّل دخولك
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
