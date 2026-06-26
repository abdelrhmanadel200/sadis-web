// GET /api/payments/zaincash/callback?token=...
//
// ZainCash redirects the customer's browser here after their payment
// session ends. The `token` query param is a signed JWT (HS256, same
// merchant secret we used to init the transaction) carrying:
//
//   { status: "success" | "failed" | "pending",
//     orderid: <our subscriptions.id>,
//     amount, msisdn, operation }
//
// We verify the token, then if status is "success" we flip the matching
// subscription row to `active` with starts_at = now and expires_at =
// now + plan.duration_days. Finally we 302 the browser back to
// /account/subscription with a status flag.

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { loadZainCashConfig, verifyCallbackToken } from '@/lib/zaincash';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APP_BASE = process.env.APP_BASE_URL || 'https://www.6thultra.com';

function redirect(status: string, subId?: string) {
  const u = new URL(`${APP_BASE}/account/subscription`);
  u.searchParams.set('zaincash', status);
  if (subId) u.searchParams.set('sub', subId);
  return Response.redirect(u.toString(), 302);
}

export async function GET(req: NextRequest) {
  const cfg = loadZainCashConfig();
  if (!cfg) return redirect('config');

  const token = req.nextUrl.searchParams.get('token') ?? '';
  if (!token) return redirect('missing');

  let payload;
  try {
    payload = verifyCallbackToken(cfg, token);
  } catch (e) {
    console.error('zaincash callback: bad signature', e);
    return redirect('invalid');
  }

  const orderId = payload.orderid;
  const status = (payload.status || '').toLowerCase();
  if (!orderId) return redirect('no_order');

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // Find the matching pending subscription + its plan.
  const { data: sub } = await admin
    .from('subscriptions')
    .select('id, plan:subscription_plans(duration_days)')
    .eq('id', orderId)
    .maybeSingle();
  if (!sub) return redirect('not_found');

  if (status !== 'success') {
    await admin
      .from('subscriptions')
      .update({ status: status === 'pending' ? 'pending' : 'failed' })
      .eq('id', sub.id);
    return redirect(status === 'pending' ? 'pending' : 'failed', sub.id);
  }

  const planArr = sub.plan as unknown as { duration_days: number }[] | null;
  const planRow = Array.isArray(planArr) ? planArr[0] : planArr;
  const duration = planRow?.duration_days ?? 30;
  const startsAt = new Date();
  const expiresAt = new Date(startsAt.getTime() + duration * 86_400_000);

  await admin
    .from('subscriptions')
    .update({
      status: 'active',
      starts_at: startsAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      paypro_order_id: payload.orderid,
      payment_method: 'zaincash',
      metadata: { zaincash: payload as unknown as Record<string, unknown> },
    })
    .eq('id', sub.id);

  return redirect('success', sub.id);
}
