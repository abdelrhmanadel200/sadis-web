'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Lock, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/providers/AuthProvider';

/**
 * Client-side gate for the paid community sections (library, lectures,
 * books, store, forum). A section is unlocked only when the signed-in user
 * has an ACTIVE `lifetime_access` subscription (the yearly platform
 * activation). Everyone else — including brand-new sign-ups — sees a
 * subscribe prompt instead of the content.
 *
 * NOTE: this is UX-layer enforcement. The data itself is additionally
 * protected by Supabase RLS + the server routes; this component just stops
 * the content from rendering for non-entitled users so the client's
 * requirement ("everything locked until activated by code") is visibly met.
 */
type AccessState = 'checking' | 'granted' | 'denied' | 'anon';

export function usePlatformAccess(): AccessState {
  const { user, loading } = useAuth();
  const [state, setState] = useState<AccessState>('checking');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (loading) return;
      if (!user) {
        if (!cancelled) setState('anon');
        return;
      }
      setState('checking');
      try {
        const nowIso = new Date().toISOString();
        const { data } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .eq('plan_id', 'lifetime_access')
          .gt('expires_at', nowIso)
          .limit(1);
        if (!cancelled) {
          setState((data && data.length > 0) ? 'granted' : 'denied');
        }
      } catch {
        // On error, fail CLOSED (denied) — the client explicitly wants
        // everything locked unless activated.
        if (!cancelled) setState('denied');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  return state;
}

export default function PlatformGate({
  children,
  sectionName,
}: {
  children: React.ReactNode;
  sectionName: string;
}) {
  const access = usePlatformAccess();

  if (access === 'checking') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (access === 'granted') {
    return <>{children}</>;
  }

  // anon or denied → locked screen
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6" dir="rtl">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center mb-6">
          <Lock className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-3">{sectionName} مقفلة</h1>
        <p className="text-muted-foreground leading-relaxed mb-6">
          هذا القسم متاح للمشتركين في تفعيل المنصة السنوي فقط. فعّل حسابك عبر
          رمز التفعيل الذي تحصل عليه من الموزّع المعتمد لفتح المكتبة والمحاضرات
          والمنتدى وباقي الأقسام لمدة سنة كاملة.
        </p>
        <Link
          href="/account/subscription"
          className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-bold bg-primary text-primary-foreground hover:opacity-90 transition"
        >
          تفعيل الحساب / إدخال الرمز
        </Link>
      </div>
    </div>
  );
}
