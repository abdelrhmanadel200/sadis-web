// POST /api/subscriptions/redeem
//
// تفعيل رمز اشتراك (الويب وتطبيق الموبايل). الطالب يدفع للموزع ويستلم رمزا
// من 16 رقما (أو رمزا قديما بصيغة SADIS-XXXX-XXXX-XXXX) ويدخله هنا.
//
// كل المنطق داخل الدالة redeem_subscription_code في قاعدة البيانات، في عملية
// واحدة ذرية: قفل لكل طالب، استخدام الرمز مرة واحدة لكل حساب، إيقاف 24 ساعة
// بعد 4 رموز غير موجودة، وتمديد شهر الذكاء من نهايته الحالية. هذا المسار فقط
// يتحقق من الحساب والحظر، ينظف الرمز، ويحول النتيجة إلى رسالة عربية واضحة.
//
// الرد دائما JSON: { ok, code?, message? } وعند النجاح
// { ok: true, plan_id, plan_name, starts_at, expires_at, sections_expires_at, ai_expires_at }.

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { toAsciiDigits } from '@/lib/iraq';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
const SERVICE_ROLE = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

// أسماء الباقات من الكود لا من قاعدة البيانات (name_ar فيها صياغة النظام القديم).
const PLAN_NAMES: Record<string, string> = {
  chat_monthly: 'الباقة الأساسية',
  lifetime_access: 'الباقة السنوية',
  ai_refill: 'إعادة تعبئة الذكاء الاصطناعي',
};

const MAX_CODE_LENGTH = 64;

interface RedeemResult {
  ok?: boolean;
  code?: string;
  plan_id?: string | null;
  subscription_id?: string | null;
  starts_at?: string | null;
  expires_at?: string | null;
  sections_expires_at?: string | null;
  ai_expires_at?: string | null;
  remaining?: number | null;
  locked?: boolean | null;
  locked_until?: string | null;
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function fail(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return json(status, { ok: false, code, message, ...extra });
}

function isoOrNull(v: unknown): string | null {
  if (typeof v !== 'string' || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function arDate(v: unknown): string | null {
  const iso = isoOrNull(v);
  return iso ? new Date(iso).toLocaleDateString('ar-IQ', { timeZone: 'Asia/Baghdad' }) : null;
}

// الرمز كما يكتبه الطالب: أرقام عربية أو فارسية، مسافات، شرطات، علامات اتجاه.
// النتيجة أحرف A-Z وأرقام وشرطة فقط، والمرشحات: كما هو، وبدون شرطات، وللرمز
// القديم المكتوب بلا شرطات صيغته الأصلية SADIS-XXXX-XXXX-XXXX.
function codeCandidates(raw: string): string[] {
  const normalized = toAsciiDigits(raw.normalize('NFKC'))
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '');
  const noDashes = normalized.replace(/-/g, '');
  const list = [normalized, noDashes];
  const legacy = /^SADIS([A-Z0-9]{4})([A-Z0-9]{4})([A-Z0-9]{4})$/.exec(noDashes);
  if (legacy) list.push(`SADIS-${legacy[1]}-${legacy[2]}-${legacy[3]}`);
  return Array.from(new Set(list.filter(Boolean)));
}

const REUSE_NOTE = 'رمزك ما زال صالحا ولم يستخدم.';

// تحويل كود الفشل من الدالة إلى حالة HTTP ورسالة للطالب.
function failureResponse(r: RedeemResult): Response {
  const code = r.code || 'unknown';
  switch (code) {
    case 'bad_request':
      return fail(400, code, 'الرمز مطلوب');
    case 'banned':
      return fail(403, code, 'تم حظر حسابك من المنصة.');
    case 'locked': {
      const until = isoOrNull(r.locked_until);
      const hours = until
        ? Math.max(1, Math.ceil((new Date(until).getTime() - Date.now()) / 3_600_000))
        : 24;
      return fail(
        429,
        code,
        `تم إيقاف التفعيل مؤقتا بسبب محاولات خاطئة متكررة. حاول بعد ${hours} ساعة.`,
        { locked_until: until },
      );
    }
    case 'not_found': {
      if (r.locked) {
        return fail(
          400,
          code,
          'الرمز غير موجود. استنفدت محاولاتك، تم إيقاف التفعيل لمدة 24 ساعة.',
          { remaining: 0, locked: true },
        );
      }
      const remaining = typeof r.remaining === 'number' ? Math.max(0, r.remaining) : null;
      return fail(
        400,
        code,
        remaining != null
          ? `الرمز غير موجود، تأكد منه وحاول مرة ثانية. المحاولات المتبقية: ${remaining}`
          : 'الرمز غير موجود، تأكد منه وحاول مرة ثانية.',
        { remaining, locked: false },
      );
    }
    case 'already_used_by_you':
      return fail(409, code, 'لقد استخدمت هذا الرمز من قبل على حسابك.');
    case 'disabled':
      return fail(400, code, 'هذا الرمز موقوف، تواصل مع فريق التفعيل');
    case 'reserved':
      return fail(400, code, 'هذا الرمز مخصص لحساب آخر');
    case 'expired':
      return fail(400, code, 'انتهت صلاحية هذا الرمز، تواصل مع فريق التفعيل');
    case 'exhausted':
      return fail(400, code, 'هذا الرمز مستخدم');
    case 'not_subscription':
      return fail(400, code, 'هذا الرمز ليس رمز اشتراك');
    case 'plan_unavailable':
      return fail(400, code, 'الباقة المرتبطة بهذا الرمز غير متاحة حاليا، تواصل مع فريق التفعيل');
    case 'ai_already_covered': {
      const ai = arDate(r.ai_expires_at);
      return fail(
        409,
        code,
        `الأستاذ ذكي مفعل عندك${ai ? ` حتى ${ai}` : ''}. ` +
          `يمكنك استخدام رمز إعادة التعبئة عندما يبقى شهر أو أقل على انتهائه. ${REUSE_NOTE}`,
        { ai_expires_at: isoOrNull(r.ai_expires_at) },
      );
    }
    case 'still_active': {
      const sec = arDate(r.sections_expires_at);
      const ai = arDate(r.ai_expires_at);
      return fail(
        409,
        code,
        `باقتك ما زالت مفعلة${sec ? ` حتى ${sec}` : ''}` +
          `${ai ? ` (الأستاذ ذكي حتى ${ai})` : ''}. ` +
          'لتجديد الأستاذ ذكي استخدم رمز إعادة التعبئة، ' +
          `وجدد الباقة عندما يبقى شهر أو أقل على انتهائها. ${REUSE_NOTE}`,
        {
          sections_expires_at: isoOrNull(r.sections_expires_at),
          ai_expires_at: isoOrNull(r.ai_expires_at),
        },
      );
    }
    default:
      return fail(400, code, 'تعذر تفعيل الرمز، تواصل مع فريق التفعيل');
  }
}

const SERVER_ERROR_MESSAGE = 'تعذر تفعيل الرمز حاليا، حاول مرة ثانية بعد قليل.';

export async function POST(req: NextRequest) {
  try {
    return await handle(req);
  } catch (e) {
    console.error('redeem: unexpected error', e);
    return fail(500, 'server_error', SERVER_ERROR_MESSAGE);
  }
}

async function handle(req: NextRequest): Promise<Response> {
  let body: { code?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail(400, 'bad_request', 'JSON غير صالح');
  }
  const raw = typeof body?.code === 'string' ? body.code : '';
  const candidates = codeCandidates(raw);
  if (candidates.length === 0) return fail(400, 'bad_request', 'الرمز مطلوب');
  if (candidates[0].length > MAX_CODE_LENGTH) {
    return fail(400, 'bad_request', 'الرمز غير صحيح، تأكد منه وحاول مرة ثانية.');
  }

  // الطالب من التوكن (الويب يحفظ الجلسة في localStorage، والتطبيق يرسل توكنه).
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) {
    return fail(401, 'unauthorized', 'سجل دخولك أولا');
  }
  const token = auth.slice(7).trim();
  if (!token) return fail(401, 'unauthorized', 'سجل دخولك أولا');
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userRes.user) return fail(401, 'unauthorized', 'سجل دخولك أولا');
  const userId = userRes.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // الحساب المحظور لا يفعل (الدالة تتحقق أيضا، هنا لعرض السبب).
  const { data: profileBan } = await admin
    .from('profiles')
    .select('banned_at, ban_reason')
    .eq('id', userId)
    .maybeSingle();
  if (profileBan?.banned_at) {
    return fail(
      403,
      'banned',
      'تم حظر حسابك من المنصة' +
        (profileBan.ban_reason ? ` (السبب: ${profileBan.ban_reason})` : '') +
        '.',
    );
  }

  const { data, error } = await admin.rpc('redeem_subscription_code', {
    p_user: userId,
    p_codes: candidates,
  });
  if (error || !data || typeof data !== 'object') {
    console.error('redeem_subscription_code failed', error ?? data);
    return fail(500, 'server_error', SERVER_ERROR_MESSAGE);
  }

  const result = data as RedeemResult;
  if (result.ok !== true) return failureResponse(result);

  const planId = result.plan_id ?? '';
  return json(200, {
    ok: true,
    plan_id: planId,
    plan_name: PLAN_NAMES[planId] ?? planId,
    starts_at: isoOrNull(result.starts_at),
    expires_at: isoOrNull(result.expires_at),
    sections_expires_at: isoOrNull(result.sections_expires_at),
    ai_expires_at: isoOrNull(result.ai_expires_at),
  });
}
