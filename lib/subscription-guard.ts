import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { computeEntitlements, type SubRow } from '@/lib/entitlements';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Free trial config — every newly-registered user gets this many free
 * AI requests before they must subscribe.
 *
 * NOTE (per client 2026-05-13): the trial is currently OPEN (unlimited)
 * while the product is in beta. Once PayPro is live we'll tighten this
 * via the FREE_TRIAL_QUOTA env var. Setting it to 0 (or unset) means no
 * gating — every signed-in user can chat freely.
 */
const FREE_TRIAL_QUOTA = Number(process.env.FREE_TRIAL_QUOTA ?? '0');
const TRIAL_OPEN = FREE_TRIAL_QUOTA <= 0;

/** Identify the user from EITHER a cookie session (web) OR an
 *  `Authorization: Bearer <jwt>` header (Flutter / direct REST). The web app
 *  uses Supabase's default localStorage persistence, so cookies aren't always
 *  set; the chat client must therefore attach the access token explicitly. */
async function resolveUser(req?: Request): Promise<{ id: string; token: string | null } | null> {
  // 1. Bearer token (works for both web and Flutter).
  const authHeader = req?.headers.get('authorization') ?? '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      try {
        const anon = createClient(SUPABASE_URL, ANON_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data } = await anon.auth.getUser(token);
        if (data.user) return { id: data.user.id, token };
      } catch {/* fall through */}
    }
  }

  // 2. Fall back to cookie-based SSR session.
  try {
    const cookieStore = await cookies();
    const userClient = createServerClient(SUPABASE_URL, ANON_KEY, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    });
    const { data } = await userClient.auth.getUser();
    if (!data.user) return null;
    const { data: sess } = await userClient.auth.getSession();
    return { id: data.user.id, token: sess.session?.access_token ?? null };
  } catch {
    return null;
  }
}

export interface AccessDecision {
  allowed: boolean;
  reason?: 'no_session' | 'no_subscription' | 'expired' | 'banned';
  /** Number of free messages remaining (only meaningful when !allowed AND
   *  the user is on the free tier). */
  freeRemaining?: number;
  /** Subscription expiry, if active. */
  expiresAt?: string | null;
  /**
   * True when the user has an active chat_monthly subscription. The chat
   * route uses this to decide between full curriculum AI (subscriber) and
   * the lightweight "sales / platform intro" demo mode (non-subscriber).
   */
  chatActive?: boolean;
  /** Admin-supplied reason when `reason === 'banned'`. */
  banReason?: string | null;
  /** Signed-in user id (set whenever a session was resolved). */
  userId?: string;
  /** The caller's own access token, for RPCs that check auth.uid(). */
  accessToken?: string | null;
}

/**
 * Decide whether the current request is allowed to hit the AI.
 *
 * Order of precedence:
 *   1. Active subscription → allow.
 *   2. User is signed in AND has used fewer than FREE_TRIAL_QUOTA messages
 *      → allow (counts toward trial).
 *   3. Otherwise → deny with `no_subscription`.
 */
export async function checkChatAccess(req?: Request): Promise<AccessDecision> {
  const who = await resolveUser(req);
  if (!who) return { allowed: false, reason: 'no_session' };
  const userId = who.id;
  const base = { userId, accessToken: who.token };

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // Check ban first — a banned profile loses access regardless of plan.
  const { data: profile } = await admin
    .from('profiles')
    .select('banned_at, ban_reason')
    .eq('id', userId)
    .maybeSingle();
  if (profile?.banned_at) {
    return {
      ...base,
      allowed: false,
      reason: 'banned',
      banReason: (profile.ban_reason as string | null) ?? null,
    };
  }

  // 1. Active AI entitlement? The 25k plan grants AI for 30 days, the 250k
  // plan for a full year — computeEntitlements derives the right window per
  // plan. Anyone with live AI access gets full curriculum AI.
  const { data: subRows } = await admin
    .from('subscriptions')
    .select('plan_id, status, starts_at, expires_at')
    .eq('user_id', userId);
  const ent = computeEntitlements((subRows ?? []) as SubRow[]);
  if (ent.aiActive) {
    return { ...base, allowed: true, chatActive: true, expiresAt: ent.aiExpiresAt };
  }

  // 2. Trial open OR signed-in non-subscriber → allowed in DEMO MODE.
  // The chat route inspects `chatActive` to pick the system prompt.
  if (TRIAL_OPEN) {
    return { ...base, allowed: true, chatActive: false };
  }

  // 3. Free trial — counted toward "messages sent". Still in demo mode
  // because the user isn't a chat subscriber.
  const { count } = await admin
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('role', 'user');

  const used = count ?? 0;
  const freeRemaining = Math.max(0, FREE_TRIAL_QUOTA - used);
  if (freeRemaining > 0) {
    return { ...base, allowed: true, chatActive: false, freeRemaining };
  }
  return { ...base, allowed: false, reason: 'no_subscription', freeRemaining: 0 };
}

/** نفس حدود تطبيق أندرويد (UsageService) والمذكورة في صفحة الأسعار. */
export const TEXT_DAILY_LIMIT = 50;
export const VOICE_DAILY_LIMIT = 5;

/**
 * يحجز سؤالا من الحد اليومي عبر increment_ai_usage، وهو نفس العداد الذي
 * يستعمله التطبيق. الدالة في القاعدة تشترط auth.uid() = p_user_id، لذلك
 * تستدعى بتوكن الطالب نفسه لا بمفتاح الخدمة. عند تعذر العد لا نمنع الطالب
 * (مثل التطبيق)، ونمنعه فقط عند بلوغ الحد فعلا.
 */
export async function consumeDailyAi(
  access: AccessDecision,
  column: 'text_count' | 'voice_count',
  limit: number,
): Promise<'ok' | 'limit' | 'error'> {
  if (!access.userId || !access.accessToken) return 'error';
  try {
    const userDb = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${access.accessToken}` } },
    });
    const { data, error } = await userDb.rpc('increment_ai_usage', {
      p_user_id: access.userId,
      p_usage_date: new Date().toISOString().slice(0, 10),
      p_column: column,
      p_limit: limit,
    });
    if (error) {
      console.error('increment_ai_usage failed', error.message);
      return 'error';
    }
    return typeof data === 'number' && data < 0 ? 'limit' : 'ok';
  } catch {
    return 'error';
  }
}

/**
 * قراءة فقط لعداد اليوم قبل خطوة مكلفة (مثل Whisper) بدون حجز سؤال. سياسة
 * RLS تسمح للطالب بقراءة صفه فقط، لذلك تستدعى بتوكنه. عند أي خطأ لا نمنع،
 * والحد الفعلي يبقى في consumeDailyAi الذري.
 */
export async function peekDailyAi(
  access: AccessDecision,
  column: 'text_count' | 'voice_count',
  limit: number,
): Promise<'ok' | 'limit' | 'error'> {
  if (!access.userId || !access.accessToken) return 'error';
  try {
    const userDb = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${access.accessToken}` } },
    });
    const { data, error } = await userDb
      .from('ai_usage_daily')
      .select(column)
      .eq('user_id', access.userId)
      .eq('usage_date', new Date().toISOString().slice(0, 10))
      .maybeSingle();
    if (error) {
      console.error('ai_usage_daily peek failed', error.message);
      return 'error';
    }
    const used = Number((data as Record<string, unknown> | null)?.[column] ?? 0);
    return Number.isFinite(used) && used >= limit ? 'limit' : 'ok';
  } catch {
    return 'error';
  }
}
