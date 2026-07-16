// Single source of truth for what a subscription grants.
//
// Pricing model (confirmed by client, option "أ"):
//
//   • 25,000 IQD  (plan_id = "chat_monthly")  — one-time purchase:
//       - ALL sections (library / lectures / books / community / store)
//         unlocked for a FULL YEAR.
//       - الأستاذ ذكي (AI chat + voice) unlocked for ONE MONTH; the student
//         renews the AI monthly to keep using it.
//
//   • 250,000 IQD (plan_id = "lifetime_access") — one-time purchase:
//       - ALL sections unlocked for a full year.
//       - الأستاذ ذكي unlocked for a full year (no monthly renewal).
//
//   • Forum: free for every signed-in user — NOT tied to any plan.
//
// Implementation note: a single 25k purchase grants two DIFFERENT windows
// (sections 365d, AI 30d). Rather than store two expiry columns, we derive
// both from the row's `starts_at` + `plan_id`, purely by date. We count a
// row whether its status is `active` OR `expired` — the daily cron flips a
// 25k row to `expired` at its 30-day `expires_at`, but its sections window
// (365d) is still valid, so we must not drop it. Rows that were reversed
// (`refunded` / `cancelled`) or never paid (`pending`) are ignored.

export const SECTIONS_DAYS = 365;
export const AI_DAYS_BY_PLAN: Record<string, number> = {
  chat_monthly: 30,
  lifetime_access: 365,
};

export interface SubRow {
  plan_id: string;
  status: string;
  starts_at: string | null;
  expires_at: string | null;
}

export interface Entitlements {
  /** Library / lectures / books / community / store. */
  sectionsActive: boolean;
  /** الأستاذ ذكي — chat + voice. */
  aiActive: boolean;
  /** Latest AI expiry across the user's rows (for "X days left" UIs). */
  aiExpiresAt: string | null;
  /** Latest sections expiry. */
  sectionsExpiresAt: string | null;
}

function addDays(iso: string, days: number): number {
  return new Date(iso).getTime() + days * 86_400_000;
}

// Rows in these states never grant anything.
const IGNORED_STATUSES = new Set(['refunded', 'cancelled', 'pending', 'failed']);

/**
 * Compute entitlements from a user's subscription rows. Pass rows in any
 * status — we count `active` and `expired` (windows are date-derived) and
 * ignore refunded/cancelled/pending/failed.
 */
export function computeEntitlements(rows: SubRow[], now = Date.now()): Entitlements {
  let sectionsActive = false;
  let aiActive = false;
  let aiExpiresAt: number | null = null;
  let sectionsExpiresAt: number | null = null;

  for (const r of rows) {
    if (IGNORED_STATUSES.has(r.status)) continue;
    const anchor = r.starts_at ?? r.expires_at;
    if (!anchor) continue;

    // Sections: both plans grant a full year.
    const secExp = addDays(anchor, SECTIONS_DAYS);
    if (secExp > now) {
      sectionsActive = true;
      if (sectionsExpiresAt === null || secExp > sectionsExpiresAt) {
        sectionsExpiresAt = secExp;
      }
    }

    // AI: plan-specific window.
    const aiDays = AI_DAYS_BY_PLAN[r.plan_id];
    if (aiDays != null) {
      const aiExp = addDays(anchor, aiDays);
      if (aiExp > now) {
        aiActive = true;
        if (aiExpiresAt === null || aiExp > aiExpiresAt) {
          aiExpiresAt = aiExp;
        }
      }
    }
  }

  return {
    sectionsActive,
    aiActive,
    aiExpiresAt: aiExpiresAt ? new Date(aiExpiresAt).toISOString() : null,
    sectionsExpiresAt: sectionsExpiresAt
      ? new Date(sectionsExpiresAt).toISOString()
      : null,
  };
}
