import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

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
async function resolveUserId(req?: Request): Promise<string | null> {
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
        if (data.user) return data.user.id;
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
    return data.user?.id ?? null;
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
  const userId = await resolveUserId(req);
  if (!userId) return { allowed: false, reason: 'no_session' };

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
      allowed: false,
      reason: 'banned',
      banReason: (profile.ban_reason as string | null) ?? null,
    };
  }

  // 1. Active chat_monthly subscription? Anyone with a live chat sub
  // gets full curriculum AI access.
  const { data: chatSub } = await admin
    .from('subscriptions')
    .select('expires_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('plan_id', 'chat_monthly')
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (chatSub) {
    return { allowed: true, chatActive: true, expiresAt: chatSub.expires_at };
  }

  // 2. Trial open OR signed-in non-subscriber → allowed in DEMO MODE.
  // The chat route inspects `chatActive` to pick the system prompt.
  if (TRIAL_OPEN) {
    return { allowed: true, chatActive: false };
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
    return { allowed: true, chatActive: false, freeRemaining };
  }
  return { allowed: false, reason: 'no_subscription', freeRemaining: 0 };
}
