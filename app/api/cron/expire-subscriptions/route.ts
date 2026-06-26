// GET /api/cron/expire-subscriptions
//
// Daily job — invoked by Vercel Cron (configured in vercel.json).
// 1. Marks any `active` subscription whose `expires_at` is in the past as
//    `expired`.
// 2. Sends a one-time "خمسة أيام لانتهاء اشتراكك" warning email to subs
//    that expire in ~5 days and haven't been warned yet.
//
// Security: Vercel cron sends `Authorization: Bearer ${CRON_SECRET}` — we
// reject anything else so this endpoint can't be hit publicly.

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { subscriptionExpiryWarningEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CRON_SECRET = process.env.CRON_SECRET || '';

export async function GET(req: NextRequest) {
  // Vercel Cron auth.
  const auth = req.headers.get('authorization') || '';
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return new Response('unauthorized', { status: 401 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // 1. Mark expired subs.
  const nowIso = new Date().toISOString();
  const { count: expiredCount } = await admin
    .from('subscriptions')
    .update({ status: 'expired', updated_at: nowIso }, { count: 'exact' })
    .eq('status', 'active')
    .lt('expires_at', nowIso);

  // 2. Find subs that expire in ~5 days and haven't been warned yet.
  const fiveDaysFrom = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  const fourDaysFrom = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();
  const { data: warning } = await admin
    .from('subscriptions')
    .select('id, user_id, plan:subscription_plans(name_ar), metadata, expires_at')
    .eq('status', 'active')
    .gte('expires_at', fourDaysFrom)
    .lte('expires_at', fiveDaysFrom);

  let warned = 0;
  for (const row of warning ?? []) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    if (meta.warned_5d) continue;
    const { data: userRes } = await admin.auth.admin.getUserById(row.user_id);
    const email = userRes?.user?.email;
    if (email) {
      const { data: unsub } = await admin
        .from('email_unsubscribes')
        .select('email')
        .eq('email', email.toLowerCase())
        .maybeSingle();
      if (unsub) continue;
      const planRow = row.plan as { name_ar?: string } | null;
      const planName = planRow?.name_ar ?? 'اشتراكك';
      await subscriptionExpiryWarningEmail({ to: email, planName, daysLeft: 5 });
      await admin
        .from('subscriptions')
        .update({ metadata: { ...meta, warned_5d: true } })
        .eq('id', row.id);
      warned += 1;
    }
  }

  return new Response(
    JSON.stringify({ ok: true, expired: expiredCount ?? 0, warned }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}
