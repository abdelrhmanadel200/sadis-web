// POST /api/subscriptions/redeem
//
// Activates a subscription by redeeming a coupon code. This is the manual
// payment workaround for users who can't use an online gateway (e.g. the
// student paid the seller in cash → seller hands them a code → they redeem
// it here to unlock the plan).
//
// Coupon schema requirement: when a coupon row has its `plan_id` column set
// to a plan from `subscription_plans`, this endpoint treats it as a
// subscription activator and inserts a row into `subscriptions` for the
// caller with status='active' and expires_at = now + plan.duration_days.
// Coupons without `plan_id` fall through unchanged (legacy money-discount
// behaviour handled by the older `redeem_coupon` RPC).
//
// Concurrency & abuse guards:
//   * one redemption per user per coupon (checked against subscriptions
//     metadata->coupon_code) — a shared multi-use promo code can't be farmed
//     by the same account for repeat subscriptions/affiliate commissions;
//   * the `used_count` bump is a compare-and-swap executed BEFORE the
//     subscription insert, so N parallel requests can't oversubscribe a
//     max_uses-limited coupon.

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
const SERVICE_ROLE = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

function bad(message: string, status = 400) {
  return new Response(JSON.stringify({ ok: false, message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function ok(body: Record<string, unknown>) {
  return new Response(JSON.stringify({ ok: true, ...body }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface SubscriptionPlan {
  id: string;
  name_ar: string;
  duration_days: number;
  price_iqd: number | null;
  price_usd: number;
}

interface CouponRow {
  code: string;
  plan_id: string | null;
  duration_days: number | null;
  max_uses: number | null;
  used_count: number | null;
  expires_at: string | null;
}

export async function POST(req: NextRequest) {
  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return bad('JSON غير صالح');
  }
  const code = (body.code || '').trim().toUpperCase();
  if (!code) return bad('الرمز مطلوب');

  // Resolve the caller from their bearer token (web client uses localStorage).
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) {
    return bad('سجّل دخول أولاً', 401);
  }
  const token = auth.slice(7).trim();
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userRes.user) return bad('سجّل دخول أولاً', 401);
  const userId = userRes.user.id;

  // From here on we use service-role so we can write to `subscriptions` and
  // touch the coupon counter even though the client doesn't own those rows.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // Banned profiles can't redeem.
  const { data: profileBan } = await admin
    .from('profiles')
    .select('banned_at, ban_reason')
    .eq('id', userId)
    .maybeSingle();
  if (profileBan?.banned_at) {
    return bad(
      'تم حظر حسابك من المنصة' +
        (profileBan.ban_reason ? ` (السبب: ${profileBan.ban_reason})` : '') +
        '.',
      403,
    );
  }

  const { data: couponRow } = await admin
    .from('coupons')
    .select('code, plan_id, duration_days, max_uses, used_count, expires_at')
    .eq('code', code)
    .maybeSingle();
  const coupon = couponRow as CouponRow | null;
  if (!coupon) return bad('الرمز غير موجود');

  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return bad('انتهت صلاحية الرمز');
  }
  if (
    coupon.max_uses != null &&
    coupon.used_count != null &&
    coupon.used_count >= coupon.max_uses
  ) {
    return bad('الرمز مستنفد');
  }

  // A subscription-coupon must point at a plan and have a positive duration.
  if (!coupon.plan_id) {
    return bad('هذا الرمز ليس رمز اشتراك');
  }

  // One redemption per user per coupon: the same account can't redeem a
  // shared multi-use code twice (subscription + commission farming).
  const { count: alreadyUsed } = await admin
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('metadata->>coupon_code', coupon.code);
  if ((alreadyUsed ?? 0) > 0) {
    return bad('لقد استخدمت هذا الرمز من قبل');
  }

  const { data: planRow } = await admin
    .from('subscription_plans')
    .select('id, name_ar, duration_days, price_iqd, price_usd')
    .eq('id', coupon.plan_id)
    .maybeSingle();
  const plan = planRow as SubscriptionPlan | null;
  if (!plan) return bad('الباقة المرتبطة بالرمز غير متاحة');

  // Claim one use FIRST via compare-and-swap: the update only matches while
  // used_count still holds the value we read, so parallel requests can't all
  // pass the max_uses check. Losing the race → ask the user to retry.
  const { data: claimed } = await admin
    .from('coupons')
    .update({ used_count: (coupon.used_count ?? 0) + 1 })
    .eq('code', coupon.code)
    .eq('used_count', coupon.used_count ?? 0)
    .select('code');
  if (!claimed || claimed.length === 0) {
    return bad('الرمز قيد الاستخدام حالياً — حاول مرة أخرى', 409);
  }

  // Effective duration: coupon may override the plan's duration (e.g. a
  // promo code that gives 60 days of chat_monthly).
  const durationDays = coupon.duration_days && coupon.duration_days > 0
    ? coupon.duration_days
    : plan.duration_days;
  const startsAt = new Date();
  const expiresAt = new Date(startsAt.getTime() + durationDays * 86_400_000);

  // Insert the user's subscription row for this plan.
  const { error: subErr } = await admin
    .from('subscriptions')
    .insert({
      user_id: userId,
      plan_id: plan.id,
      status: 'active',
      amount_usd: plan.price_usd ?? 0,
      amount_iqd: plan.price_iqd ?? 0,
      currency: plan.price_iqd ? 'IQD' : 'USD',
      payment_method: 'coupon',
      starts_at: startsAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      metadata: { coupon_code: coupon.code },
    });
  if (subErr) {
    console.error('insert subscription failed', subErr);
    // Compensate: release the use we claimed so the coupon isn't burned.
    await admin
      .from('coupons')
      .update({ used_count: coupon.used_count ?? 0 })
      .eq('code', coupon.code)
      .eq('used_count', (coupon.used_count ?? 0) + 1);
    return bad('تعذّر تفعيل الاشتراك، حاول مرة أخرى', 500);
  }

  return ok({
    plan_id: plan.id,
    plan_name: plan.name_ar,
    expires_at: expiresAt.toISOString(),
  });
}
