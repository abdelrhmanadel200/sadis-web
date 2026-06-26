'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

/**
 * Client-side bridge between Discourse SSO and our /api/sso/discourse server
 * route. Why we need this:
 *
 *   Discourse sends the visitor to /api/sso/discourse with `?sso=…&sig=…`.
 *   The server route needs to know WHO the visitor is. Our Supabase JS client
 *   stores its session in localStorage (not cookies), so the server route
 *   can't see it from a plain GET.
 *
 *   This page runs in the browser, reads the access_token from the Supabase
 *   client, then POSTs to /api/sso/discourse with `Authorization: Bearer`
 *   and the sso/sig. The server returns JSON with a `redirect_url` we
 *   navigate to. Avoids the opaqueredirect trap of doing fetch(GET).
 *
 *   If the user isn't signed in, we bounce them through /login?next=<this
 *   page with the same sso/sig>.
 */
export default function DiscourseSsoBridge() {
  return (
    <Suspense fallback={null}>
      <DiscourseSsoBridgeInner />
    </Suspense>
  );
}

function DiscourseSsoBridgeInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [statusText, setStatusText] = useState('جاري تحويلك للمنتدى...');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Read sso/sig either directly from this URL OR from the `next` param
      // pointing at /api/sso/discourse?... (older code path).
      let sso = params.get('sso') ?? '';
      let sig = params.get('sig') ?? '';
      if (!sso || !sig) {
        const rawNext = params.get('next') ?? '';
        if (rawNext.startsWith('/api/sso/discourse')) {
          try {
            const nextUrl = new URL(rawNext, window.location.origin);
            sso = nextUrl.searchParams.get('sso') ?? '';
            sig = nextUrl.searchParams.get('sig') ?? '';
          } catch {/* malformed */}
        }
      }

      if (!sso || !sig) {
        if (!cancelled) setStatusText('رابط غير صالح');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        if (cancelled) return;
        setStatusText('يتطلب تسجيل الدخول...');
        const here = `/sso/discourse?sso=${encodeURIComponent(sso)}&sig=${encodeURIComponent(sig)}`;
        router.replace(`/login?next=${encodeURIComponent(here)}`);
        return;
      }

      try {
        const res = await fetch('/api/sso/discourse', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ sso, sig }),
        });
        const data = await res.json();
        if (res.ok && data.ok && data.redirect_url) {
          window.location.assign(data.redirect_url);
          return;
        }
        if (cancelled) return;
        setStatusText(data.message || 'تعذّر الدخول للمنتدى');
      } catch (e) {
        if (cancelled) return;
        setStatusText(
          e instanceof Error ? `خطأ: ${e.message}` : 'تعذّر الاتصال بالخادم',
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params, router]);

  return (
    <main
      className="min-h-screen flex items-center justify-center bg-background text-foreground"
      dir="rtl"
    >
      <div className="text-sm text-muted">{statusText}</div>
    </main>
  );
}
