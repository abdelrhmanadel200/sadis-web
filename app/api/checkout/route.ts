// POST /api/checkout
//
// Body: { plan_id: string }
//
// Initiates a paid checkout for the authenticated user. The flow forks by
// plan:
//
//   - `chat_monthly` (25,000 IQD)      → goes through ZainCash. We create
//     a `pending` subscription row, call /transaction/init on ZainCash,
//     and return the hosted pay URL the browser should navigate to.
//
//   - `lifetime_access` (250,000 IQD)  → online checkout is intentionally
//     blocked. This plan is only redeemable via coupon codes the admin
//     hands out manually.
//
// The webhook at /api/payments/zaincash/callback flips the row to
// `active` once ZainCash confirms the payment.

import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { initTransaction, loadZainCashConfig } from '@/lib/zaincash';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APP_BASE = process.env.APP_BASE_URL || 'https://www.6thultra.com';

function bad(message: string, status = 400) {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(req: NextRequest) {
  // 1. Identify the caller. We accept either a cookie session OR a bearer
  // token (Flutter / direct REST callers).
  const auth = req.headers.get('authorization') ?? '';
  let userId: string | null = null;
  let userEmail = '';

  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await anon.auth.getUser(token);
    if (data.user) {
      userId = data.user.id;
      userEmail = data.user.email ?? '';
    }
  }

  if (!userId) {
    const cookieStore = await cookies();
    const userClient = createServerClient(SUPABASE_URL, ANON_KEY, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (userData.user) {
      userId = userData.user.id;
      userEmail = userData.user.email ?? '';
    }
  }
  if (!userId) return bad('غير مصرّح، سجّل دخولك أولاً', 401);

  // 1b. Reject banned profiles.
  const admin0 = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });
  const { data: profileBan } = await admin0
    .from('profiles')
    .select('banned_at, ban_reason')
    .eq('id', userId)
    .maybeSingle();
  if (profileBan?.banned_at) {
    return bad(
      'تم حظر حسابك من المنصة' +
        (profileBan.ban_reason ? ` (السبب: ${profileBan.ban_reason})` : '') +
        '. للاستفسار تواصل مع الدعم.',
      403,
    );
  }

  // 2. Validate the requested plan.
  let body: { plan_id?: string };
  try {
    body = await req.json();
  } catch {
    return bad('JSON body مطلوب');
  }
  const planId = (body.plan_id || '').trim();
  if (!planId) return bad('plan_id مطلوب');

  // Yearly platform activation is coupon-only — no online checkout.
  if (planId === 'lifetime_access') {
    return bad(
      'الباقة السنوية تُفعَّل عبر رمز يتم استلامه من الموزّع. ادخل الرمز في صفحة الاشتراك.',
      400,
    );
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });
  const { data: plan, error: planErr } = await admin
    .from('subscription_plans')
    .select('*')
    .eq('id', planId)
    .eq('active', true)
    .maybeSingle();
  if (planErr || !plan) return bad('الباقة غير متاحة', 404);

  // 3. Create a pending subscription row. The callback handler will flip
  // it to `active` once ZainCash confirms the charge. The row id is the
  // `orderId` we hand to ZainCash so the callback knows which row to
  // settle.
  const { data: sub, error: insertErr } = await admin
    .from('subscriptions')
    .insert({
      user_id: userId,
      plan_id: planId,
      status: 'pending',
      amount_usd: plan.price_usd,
      amount_iqd: plan.price_iqd,
      currency: plan.price_iqd ? 'IQD' : 'USD',
      payment_method: 'zaincash',
    })
    .select('id')
    .single();
  if (insertErr || !sub) {
    console.error('checkout: create subscription failed', insertErr);
    return bad('تعذّر إنشاء الطلب، حاول مرة أخرى', 500);
  }

  // 4. Initiate the ZainCash transaction.
  const cfg = loadZainCashConfig();
  if (!cfg) {
    return bad(
      'بوابة الدفع غير مفعّلة بعد. يرجى استخدام رمز التفعيل أو المحاولة لاحقاً.',
      503,
    );
  }
  if (!plan.price_iqd || plan.price_iqd <= 0) {
    return bad('الباقة لا تحتوي على سعر بالدينار العراقي', 400);
  }

  try {
    const result = await initTransaction(cfg, {
      amountIQD: plan.price_iqd,
      orderId: sub.id,
      redirectUrl: `${APP_BASE}/api/payments/zaincash/callback`,
    });
    return new Response(
      JSON.stringify({
        subscription_id: sub.id,
        checkout_url: result.payUrl,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('zaincash init failed', e, { email: userEmail });
    await admin
      .from('subscriptions')
      .update({ status: 'failed' })
      .eq('id', sub.id);
    return bad('تعذّر بدء عملية الدفع، حاول مرة أخرى', 502);
  }
}
