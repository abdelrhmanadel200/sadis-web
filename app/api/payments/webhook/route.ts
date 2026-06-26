// POST /api/payments/webhook
//
// PayPro Global posts here on every order lifecycle event (sale, refund,
// chargeback, expiry, …). We:
//   1. Verify the signature against PAYPRO_WEBHOOK_SECRET.
//   2. Look up the pending subscription via `custom-id` (the row ID we put
//      in the checkout URL).
//   3. Update its status / starts_at / expires_at / paypro_order_id.
//   4. Best-effort fire a confirmation email via Resend.
//
// PayPro signature scheme (per their docs): an `IPN_SECRET_KEY` (we name it
// PAYPRO_WEBHOOK_SECRET) is MD5-hashed with the order data and posted as the
// `IPN_SECRET_HASH` field. We verify by re-hashing and comparing.

import { NextRequest } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { subscriptionActivatedEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const WEBHOOK_SECRET = process.env.PAYPRO_WEBHOOK_SECRET || '';

function ok(body: Record<string, unknown> = { ok: true }) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
function bad(message: string, status = 400) {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function verifyPayProSignature(payload: Record<string, string>): boolean {
  if (!WEBHOOK_SECRET) return false;
  const expected = payload['IPN_SECRET_HASH'];
  if (!expected) return false;
  // PayPro builds the hash from the order id + product id + amount + secret.
  // The exact recipe is account-specific; the client should confirm it from
  // the PayPro IPN docs. We implement the standard one here.
  const parts = [
    payload['ORDER_ID'] || '',
    payload['PRODUCT_ID'] || '',
    payload['ORDER_TOTAL_AMOUNT'] || payload['AMOUNT'] || '',
    WEBHOOK_SECRET,
  ];
  const computed = createHash('md5').update(parts.join('')).digest('hex');
  // Constant-time compare to avoid timing leaks.
  const a = Buffer.from(computed);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Email sending moved to lib/email.ts (`subscriptionActivatedEmail`).

export async function POST(req: NextRequest) {
  // PayPro IPN posts application/x-www-form-urlencoded.
  let raw: Record<string, string>;
  try {
    const text = await req.text();
    const params = new URLSearchParams(text);
    raw = Object.fromEntries(params.entries());
  } catch {
    return bad('Invalid payload');
  }

  // Reject if signature missing/wrong. In dev (no secret) we skip verify
  // and just log so the client can test before going live.
  if (WEBHOOK_SECRET && !verifyPayProSignature(raw)) {
    console.warn('PayPro webhook signature mismatch', raw);
    return bad('Invalid signature', 403);
  }

  const eventType = raw['EVENT_TYPE'] || raw['ORDER_STATUS'] || '';
  const customId = raw['CUSTOM_ID'] || raw['custom-id'] || '';
  const paypoOrderId = raw['ORDER_ID'] || '';

  if (!customId) {
    // Webhook without our custom_id — log and ack so PayPro doesn't retry.
    console.warn('PayPro webhook missing custom_id', raw);
    return ok();
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // Fetch the pending subscription + its plan.
  const { data: sub, error: subErr } = await admin
    .from('subscriptions')
    .select('*, plan:subscription_plans(*)')
    .eq('id', customId)
    .maybeSingle();
  if (subErr || !sub) {
    console.warn('Subscription not found for custom_id', customId);
    return ok();
  }

  // Branch by event type.
  if (
    eventType === 'ORDER_CHARGED_SUCCESSFULLY' ||
    eventType === 'CHARGED' ||
    eventType === 'sale'
  ) {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + (sub.plan.duration_days || 30) * 24 * 60 * 60 * 1000,
    );

    await admin
      .from('subscriptions')
      .update({
        status: 'active',
        starts_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        paypro_order_id: paypoOrderId || null,
        payment_method: raw['PAYMENT_METHOD'] || raw['PAYMENT_TYPE'] || null,
        updated_at: now.toISOString(),
      })
      .eq('id', sub.id);

    // Best-effort confirmation email (only if the user hasn't unsubscribed).
    const { data: userRes } = await admin.auth.admin.getUserById(sub.user_id);
    const email = userRes?.user?.email || raw['CUSTOMER_EMAIL'] || '';
    if (email) {
      const { data: unsub } = await admin
        .from('email_unsubscribes')
        .select('email')
        .eq('email', email.toLowerCase())
        .maybeSingle();
      if (!unsub) {
        await subscriptionActivatedEmail({
          to: email,
          planName: sub.plan.name_ar || sub.plan.id,
          expiresAt,
          invoiceId: paypoOrderId || sub.id,
        });
      }
    }
    return ok();
  }

  if (
    eventType === 'ORDER_REFUNDED' ||
    eventType === 'REFUND' ||
    eventType === 'refund'
  ) {
    await admin
      .from('subscriptions')
      .update({
        status: 'refunded',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sub.id);
    return ok();
  }

  if (
    eventType === 'ORDER_CANCELLED' ||
    eventType === 'cancel'
  ) {
    await admin
      .from('subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sub.id);
    return ok();
  }

  // Unknown event — ack so we don't get retried indefinitely.
  console.log('Unhandled PayPro event', eventType, customId);
  return ok();
}
