// Single source of truth for what a subscription grants.
//
// Pricing model (confirmed by client, option "أ"):
//
//   • 25,000 IQD  (plan_id = "chat_monthly")  — one-time purchase:
//       - ALL sections (library / lectures / books / community)
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

// Sections window per plan — `ai_refill` deliberately grants NO sections
// (it's an AI-month top-up for students whose sections year is already
// running from a previous 25k/250k activation).
export const SECTIONS_DAYS_BY_PLAN: Record<string, number> = {
  chat_monthly: 365,
  lifetime_access: 365,
};
export const AI_DAYS_BY_PLAN: Record<string, number> = {
  chat_monthly: 30,
  lifetime_access: 365,
  ai_refill: 30,
};

export interface SubRow {
  plan_id: string;
  status: string;
  starts_at: string | null;
  expires_at: string | null;
}

export interface Entitlements {
  /** Library / lectures / books / community (the supplies store is public). */
  sectionsActive: boolean;
  /** الأستاذ ذكي — chat + voice. */
  aiActive: boolean;
  /** Latest AI expiry across the user's rows (for "X days left" UIs). */
  aiExpiresAt: string | null;
  /** Latest sections expiry. */
  sectionsExpiresAt: string | null;
  /**
   * بداية فترة الأقسام الحالية (أقدم بداية بين الصفوف التي ما زالت تغطي اليوم
   * أو بعده)، أو بداية آخر فترة إن كانت منتهية.
   */
  sectionsStartsAt: string | null;
  /** الباقة التي تعطي أبعد نهاية للأقسام. */
  sectionsPlanId: string | null;
  /** أبعد نهاية للأقسام حتى لو انتهت (لعرض "انتهى في"). */
  lastSectionsExpiresAt: string | null;
  /** بداية فترة الذكاء الحالية (تشمل إعادة التعبئة المتتالية). */
  aiStartsAt: string | null;
  /** الباقة التي تعطي أبعد نهاية للذكاء. */
  aiPlanId: string | null;
  /** أبعد نهاية للذكاء حتى لو انتهت. */
  lastAiExpiresAt: string | null;
  /** الذكاء سنوي (الباقة السنوية هي مصدر أبعد نهاية). */
  aiYearly: boolean;
  /** يوجد أي صف اشتراك محسوب (مفعل أو منتهي). */
  hasHistory: boolean;
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
  type Win = { start: number; end: number; plan: string };
  const sec: Win[] = [];
  const ai: Win[] = [];

  for (const r of rows) {
    if (IGNORED_STATUSES.has(r.status)) continue;
    const anchor = r.starts_at ?? r.expires_at;
    if (!anchor) continue;
    const start = new Date(anchor).getTime();

    // Sections: plan-specific window (ai_refill grants none).
    const secDays = SECTIONS_DAYS_BY_PLAN[r.plan_id];
    if (secDays != null) sec.push({ start, end: addDays(anchor, secDays), plan: r.plan_id });

    // AI: plan-specific window. A stacked ai_refill row may start in the future.
    const aiDays = AI_DAYS_BY_PLAN[r.plan_id];
    if (aiDays != null) ai.push({ start, end: addDays(anchor, aiDays), plan: r.plan_id });
  }

  const summarize = (wins: Win[]) => {
    if (wins.length === 0) {
      return { active: false, end: null, start: null, plan: null, lastEnd: null };
    }
    // أبعد نهاية تحدد الباقة؛ عند التساوي تفضل الباقة السنوية.
    const best = wins.reduce((a, b) =>
      b.end > a.end || (b.end === a.end && b.plan === 'lifetime_access') ? b : a,
    );
    const live = wins.filter((w) => w.end > now);
    const active = live.length > 0;
    const start = active ? Math.min(...live.map((w) => w.start)) : best.start;
    return { active, end: active ? best.end : null, start, plan: best.plan, lastEnd: best.end };
  };

  const s = summarize(sec);
  const a = summarize(ai);
  const iso = (t: number | null) => (t === null ? null : new Date(t).toISOString());

  return {
    sectionsActive: s.active,
    aiActive: a.active,
    aiExpiresAt: iso(a.end),
    sectionsExpiresAt: iso(s.end),
    sectionsStartsAt: iso(s.start),
    sectionsPlanId: s.plan,
    lastSectionsExpiresAt: iso(s.lastEnd),
    aiStartsAt: iso(a.start),
    aiPlanId: a.plan,
    lastAiExpiresAt: iso(a.lastEnd),
    aiYearly: a.active && a.plan === 'lifetime_access',
    hasHistory: sec.length + ai.length > 0,
  };
}
