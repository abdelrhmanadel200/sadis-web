'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/providers/AuthProvider';

const STORAGE_KEY = 'sadis_ref_code';

/**
 * Global, invisible referral-attribution helper (affiliate system).
 *
 * 1. On any page load, if the URL carries `?ref=CODE`, remember the code in
 *    localStorage (reading window.location directly avoids the Suspense
 *    requirement of useSearchParams).
 * 2. Once a user is signed in and a code is stored, call the `record_referral`
 *    RPC. The RPC enforces all the rules (first attribution wins, no
 *    self-referral, no existing subscribers). The stored code is cleared once
 *    the RPC has actually run; a transient network failure keeps it so the
 *    next page load retries.
 */
export default function ReferralCapture() {
  const { user, loading } = useAuth();

  // Capture ?ref= from the URL.
  useEffect(() => {
    try {
      const code = new URLSearchParams(window.location.search).get('ref');
      if (code && /^[a-zA-Z0-9]{3,16}$/.test(code)) {
        localStorage.setItem(STORAGE_KEY, code.toUpperCase());
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Attribute once signed in.
  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const code = localStorage.getItem(STORAGE_KEY);
        if (!code) return;
        // supabase-js never throws — failures come back in `error`. Clear the
        // stored code only when the RPC actually ran (whatever its boolean
        // verdict); on a transient network error keep it so the next page
        // load retries the attribution.
        const { error } = await supabase.rpc('record_referral', {
          p_code: code,
          p_source: 'link',
        });
        if (!cancelled && !error) localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* keep the code; retry on next load */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  return null;
}
