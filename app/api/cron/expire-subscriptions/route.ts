// GET /api/cron/expire-subscriptions
//
// مهمة يومية (Vercel Cron في vercel.json):
// 1. تحول كل اشتراك active انتهى expires_at الخاص به إلى expired.
//    (الاستحقاقات تحسب الصفوف المنتهية أيضا، فصف 25 ألف القديم الذي ينتهي
//    بعد شهر الذكاء لا يغلق الأقسام.)
// 2. تلغي طلبات المتجر الجديدة التي لم تؤكد خلال 7 أيام (store_expire_stale_orders).
// 3. ترسل تنبيها واحدا بالبريد قبل 5 أيام من الانتهاء:
//    - صف 25 ألف قديم (مدته شهر) أو صف إعادة تعبئة: ينتهي شهر الأستاذ ذكي فقط.
//    - غير ذلك: تنتهي الباقة (الأقسام).
//    لا يرسل إذا كانت الفترة نفسها ممتدة بصف آخر (تجديد أو تعبئة متتالية)،
//    ولا لحسابات الهاتف ذات البريد الوهمي.
//
// الحماية: Vercel Cron يرسل `Authorization: Bearer ${CRON_SECRET}`.

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { subscriptionExpiryWarningEmail } from '@/lib/email';
import { computeEntitlements, type SubRow } from '@/lib/entitlements';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CRON_SECRET = process.env.CRON_SECRET || '';

const DAY_MS = 24 * 60 * 60 * 1000;
const SYNTHETIC_EMAIL_SUFFIX = '@phone.sadisultra.local';

// أسماء الباقات من الكود لا من قاعدة البيانات.
const PLAN_NAMES: Record<string, string> = {
  chat_monthly: 'الباقة الأساسية',
  lifetime_access: 'الباقة السنوية',
  ai_refill: 'إعادة تعبئة الذكاء الاصطناعي',
};

interface WarnRow {
  id: string;
  user_id: string;
  plan_id: string | null;
  metadata: Record<string, unknown> | null;
  starts_at: string | null;
  expires_at: string | null;
}

// صف ينتهي فيه شهر الأستاذ ذكي فقط: إعادة التعبئة، أو صف 25 ألف قديم
// كانت مدته شهرا (الصفوف الجديدة مدتها سنة).
function isAiMonthRow(row: WarnRow): boolean {
  if (row.plan_id === 'ai_refill') return true;
  if (row.plan_id !== 'chat_monthly' || !row.starts_at || !row.expires_at) return false;
  const span = new Date(row.expires_at).getTime() - new Date(row.starts_at).getTime();
  return span <= 31 * DAY_MS;
}

export async function GET(req: NextRequest) {
  // Vercel Cron auth.
  const auth = req.headers.get('authorization') || '';
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return new Response('unauthorized', { status: 401 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // 1. الاشتراكات المنتهية.
  const nowIso = new Date().toISOString();
  const { count: expiredCount, error: expireErr } = await admin
    .from('subscriptions')
    .update({ status: 'expired', updated_at: nowIso }, { count: 'exact' })
    .eq('status', 'active')
    .lt('expires_at', nowIso);
  if (expireErr) console.error('cron: expire subscriptions failed', expireErr);

  // 2. طلبات المتجر المعلقة أكثر من 7 أيام (لا توقف بقية المهمة إذا فشلت).
  let staleOrders = 0;
  try {
    const { data: staleCount, error: staleErr } = await admin.rpc('store_expire_stale_orders');
    if (staleErr) console.error('cron: store_expire_stale_orders failed', staleErr);
    else if (typeof staleCount === 'number') staleOrders = staleCount;
  } catch (e) {
    console.error('cron: store_expire_stale_orders threw', e);
  }

  // 3. صفوف تنتهي بعد 4 إلى 5 أيام ولم ينبه أصحابها بعد.
  const fiveDaysFrom = new Date(Date.now() + 5 * DAY_MS).toISOString();
  const fourDaysFrom = new Date(Date.now() + 4 * DAY_MS).toISOString();
  const { data: warning, error: warnErr } = await admin
    .from('subscriptions')
    .select('id, user_id, plan_id, metadata, starts_at, expires_at')
    .eq('status', 'active')
    .gte('expires_at', fourDaysFrom)
    .lte('expires_at', fiveDaysFrom);
  if (warnErr) console.error('cron: load expiring subscriptions failed', warnErr);

  const rowsByUser = new Map<string, SubRow[]>();
  let warned = 0;
  let skipped = 0;
  for (const row of (warning ?? []) as WarnRow[]) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    if (meta.warned_5d || !row.user_id || !row.expires_at) continue;

    const { data: userRes } = await admin.auth.admin.getUserById(row.user_id);
    const email = (userRes?.user?.email || '').trim().toLowerCase();
    // حسابات الهاتف بريدها وهمي: الإرسال له يضر سمعة المرسل.
    if (!email || email.endsWith(SYNTHETIC_EMAIL_SUFFIX)) {
      skipped += 1;
      continue;
    }

    const { data: unsub } = await admin
      .from('email_unsubscribes')
      .select('email')
      .eq('email', email)
      .maybeSingle();
    if (unsub) continue;

    // الفترة الفعلية للطالب: إذا جدد أو عبأ مسبقا فلا داعي للتنبيه.
    let subs = rowsByUser.get(row.user_id);
    if (!subs) {
      const { data: userSubs, error: subsErr } = await admin
        .from('subscriptions')
        .select('plan_id, status, starts_at, expires_at')
        .eq('user_id', row.user_id);
      if (subsErr) {
        console.error('cron: load user subscriptions failed', row.user_id, subsErr);
        continue;
      }
      subs = (userSubs ?? []) as SubRow[];
      rowsByUser.set(row.user_id, subs);
    }
    const ent = computeEntitlements(subs);
    const aiOnly = isAiMonthRow(row);
    const windowEnd = aiOnly ? ent.aiExpiresAt : ent.sectionsExpiresAt ?? ent.aiExpiresAt;
    const rowEnd = new Date(row.expires_at).getTime();
    if (windowEnd && new Date(windowEnd).getTime() > rowEnd + DAY_MS) {
      skipped += 1;
      continue;
    }

    const sectionsUntil =
      aiOnly && ent.sectionsActive && ent.sectionsExpiresAt ? new Date(ent.sectionsExpiresAt) : null;
    const res = await subscriptionExpiryWarningEmail({
      to: email,
      planName: PLAN_NAMES[row.plan_id ?? ''] ?? 'اشتراكك',
      daysLeft: 5,
      kind: aiOnly ? 'ai' : 'plan',
      sectionsUntil,
      withAi: row.plan_id === 'lifetime_access',
    });
    if (res.error) {
      console.error('cron: warning email failed', row.id, res.error);
      continue;
    }
    const { error: markErr } = await admin
      .from('subscriptions')
      .update({ metadata: { ...meta, warned_5d: true } })
      .eq('id', row.id);
    if (markErr) console.error('cron: mark warned failed', row.id, markErr);
    warned += 1;
  }

  return new Response(
    JSON.stringify({
      ok: true,
      expired: expiredCount ?? 0,
      stale_orders_cancelled: staleOrders,
      warned,
      skipped,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}
