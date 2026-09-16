// أدوات السيرفر للدخول بكلمة المرور وتغييرها وإصدار الجلسات. للسيرفر فقط
// (تستورد crypto ومفتاح الخدمة)، لا تستوردها من صفحة أو مكون.

import { createHmac } from 'crypto';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { adminClient } from '@/lib/phone-otp';

export { adminClient };

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
// مفاتيح عداد المحاولات: HMAC فقط، لا يخزن رقم أو بريد أو IP كما هو.
const ATTEMPT_PEPPER = process.env.OTP_PEPPER || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const SYNTHETIC_EMAIL_SUFFIX = '@phone.sadisultra.local';

export interface TokenSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface LoginUser {
  id: string;
  email: string | null;
  has_password: boolean;
}

export type GotrueFailure = { ok: false; status: number; code: string; message: string };

/* ───────────── ردود JSON ───────────── */

export function json(status: number, body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}

/** يؤخر الرد حتى يمر minMs من بدايته، حتى لا يكشف الوقت وجود الحساب. */
export async function padResponseTime(startedAt: number, minMs = 400): Promise<void> {
  const wait = minMs - (Date.now() - startedAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

/** "حاول بعد N دقيقة" من ثوان. */
export function minutesText(seconds: number): string {
  const m = Math.max(1, Math.ceil(seconds / 60));
  return m === 1 ? 'دقيقة' : m === 2 ? 'دقيقتين' : m <= 10 ? `${m} دقائق` : `${m} دقيقة`;
}

/* ───────────── الطلب ───────────── */

/** IP الطالب. Vercel يكتب هذه الرؤوس بنفسه، فلا يستطيع الطالب تزويرها. */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  const first = xff?.split(',')[0]?.trim();
  if (first) return first;
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

export function attemptKey(kind: string, value: string): string {
  return createHmac('sha256', ATTEMPT_PEPPER).update(`${kind}:${value}`).digest('hex');
}

export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** صاحب التوكن في Authorization: Bearer، بعد التحقق منه عند Supabase. */
export async function bearerUser(req: Request): Promise<{ user: User; token: string } | null> {
  const header = req.headers.get('authorization') ?? '';
  if (!/^bearer\s+/i.test(header)) return null;
  const token = header.replace(/^bearer\s+/i, '').trim();
  if (!token) return null;
  try {
    const { data, error } = await anonClient().auth.getUser(token);
    if (error || !data.user) return null;
    return { user: data.user, token };
  } catch (e) {
    console.error('auth-server: getUser failed', e);
    return null;
  }
}

const OTP_AMR_METHODS = new Set(['otp', 'magiclink', 'recovery']);
export const OTP_FRESH_SECONDS = 10 * 60;

/**
 * هل الجلسة من دخول برمز تحقق (SMS أو بريد) قبل maxAgeSeconds؟ هذا طريق
 * "نسيت كلمة المرور". يقرأ amr من التوكن، فاستدعه فقط بعد bearerUser (Supabase
 * تحقق من التوقيع والجلسة).
 */
export function recentOtpLogin(accessToken: string, maxAgeSeconds = OTP_FRESH_SECONDS): boolean {
  try {
    const part = accessToken.split('.')[1];
    if (!part) return false;
    const payload = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as { amr?: unknown };
    if (!Array.isArray(payload.amr)) return false;
    const now = Math.floor(Date.now() / 1000);
    return payload.amr.some((entry: unknown) => {
      const e = entry as { method?: unknown; timestamp?: unknown } | null;
      return (
        !!e &&
        OTP_AMR_METHODS.has(String(e.method)) &&
        typeof e.timestamp === 'number' &&
        e.timestamp <= now + 60 &&
        now - e.timestamp <= maxAgeSeconds
      );
    });
  } catch {
    return false;
  }
}

/* ───────────── قاعدة البيانات ───────────── */

export type ClaimResult =
  | { ok: true; allowed: boolean; retryAfter: number }
  | { ok: false; error: unknown };

/** يحجز محاولة بشكل ذري (auth_attempt_claim). */
export async function claimAttempt(
  supa: SupabaseClient,
  key: string,
  max: number,
  windowSeconds: number,
  lockSeconds: number,
): Promise<ClaimResult> {
  const { data, error } = await supa.rpc('auth_attempt_claim', {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
    p_lock_seconds: lockSeconds,
  });
  if (error) return { ok: false, error };
  const row = (data as { allowed: boolean; retry_after: number }[] | null)?.[0];
  if (!row) return { ok: false, error: new Error('auth_attempt_claim returned no row') };
  return { ok: true, allowed: !!row.allowed, retryAfter: Number(row.retry_after) || 0 };
}

export async function attemptSuccess(supa: SupabaseClient, identKey: string, ipKey: string): Promise<void> {
  const { error } = await supa.rpc('auth_attempt_success', { p_ident_key: identKey, p_ip_key: ipKey });
  if (error) console.error('auth-server: auth_attempt_success failed', error);
}

/** بحث مفهرس عن حساب برقم الهاتف (أرقام بدون +) أو البريد. */
export async function findLoginUser(
  supa: SupabaseClient,
  args: { phone?: string | null; email?: string | null },
): Promise<{ ok: true; user: LoginUser | null } | { ok: false; error: unknown }> {
  const params: Record<string, string> = {};
  if (args.phone) params.p_phone = args.phone;
  if (args.email) params.p_email = args.email;
  const { data, error } = await supa.rpc('auth_find_login_user', params);
  if (error) return { ok: false, error };
  const row = (data as LoginUser[] | null)?.[0] ?? null;
  return {
    ok: true,
    user: row ? { id: row.id, email: row.email ?? null, has_password: !!row.has_password } : null,
  };
}

/* ───────────── Supabase Auth (GoTrue) ───────────── */

function gotrueHeaders(bearer?: string): Record<string, string> {
  const h: Record<string, string> = {
    apikey: ANON_KEY,
    'Content-Type': 'application/json',
    'X-Supabase-Api-Version': '2024-01-01',
  };
  if (bearer) h.Authorization = `Bearer ${bearer}`;
  return h;
}

async function readGotrueError(res: Response): Promise<{ code: string; message: string }> {
  const text = await res.text().catch(() => '');
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* ليس JSON */
  }
  const str = (v: unknown) => (typeof v === 'string' && v ? v : '');
  let code = str(body.error_code) || str(body.code) || str(body.error);
  if (code === 'invalid_grant') code = 'invalid_credentials';
  const message = str(body.message) || str(body.msg) || str(body.error_description) || text.slice(0, 200);
  return { code: code || `http_${res.status}`, message };
}

function toSession(tok: Record<string, unknown> | null | undefined): TokenSession | null {
  if (!tok || typeof tok.access_token !== 'string' || typeof tok.refresh_token !== 'string') return null;
  return {
    access_token: tok.access_token,
    refresh_token: tok.refresh_token,
    expires_in: Number(tok.expires_in) || 3600,
  };
}

/** دخول بالبريد وكلمة المرور من السيرفر (GoTrue يرفض الدخول بالهاتف مباشرة). */
export async function passwordGrant(
  email: string,
  password: string,
): Promise<{ ok: true; session: TokenSession; userId: string | null } | GotrueFailure> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: gotrueHeaders(),
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });
    if (!res.ok) return { ok: false, status: res.status, ...(await readGotrueError(res)) };
    const tok = (await res.json()) as Record<string, unknown>;
    const session = toSession(tok);
    if (!session) return { ok: false, status: 502, code: 'bad_response', message: 'no tokens' };
    const user = tok.user as { id?: string } | undefined;
    return { ok: true, session, userId: user?.id ?? null };
  } catch (e) {
    console.error('auth-server: password grant network error', e);
    return { ok: false, status: 0, code: 'network_error', message: String(e) };
  }
}

/**
 * يغير كلمة مرور صاحب التوكن بتوكنه هو (PUT /auth/v1/user): الجلسة الحالية
 * تبقى، وباقي الأجهزة تخرج.
 */
export async function updateOwnPassword(
  accessToken: string,
  password: string,
): Promise<{ ok: true } | GotrueFailure> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: gotrueHeaders(accessToken),
      body: JSON.stringify({ password }),
      cache: 'no-store',
    });
    if (!res.ok) return { ok: false, status: res.status, ...(await readGotrueError(res)) };
    return { ok: true };
  } catch (e) {
    console.error('auth-server: update password network error', e);
    return { ok: false, status: 0, code: 'network_error', message: String(e) };
  }
}

/** يلغي جلسة واحدة فقط (جلسة التحقق من كلمة المرور الحالية مثلا). */
export async function revokeSession(accessToken: string): Promise<void> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/logout?scope=local`, {
      method: 'POST',
      headers: gotrueHeaders(accessToken),
      cache: 'no-store',
    });
    if (!res.ok && res.status !== 401 && res.status !== 404) {
      console.error('auth-server: logout failed', res.status);
    }
  } catch (e) {
    console.error('auth-server: logout network error', e);
  }
}

/**
 * token_hash لرابط سحري (لا يرسل بريدا، يعمل مع بريد الهاتف الاصطناعي).
 * محاولة ثانية عند الفشل. طلب رابط جديد لنفس الحساب يبطل الرابط السابق.
 */
export async function mintMagicLinkHash(email: string, supa: SupabaseClient = adminClient()): Promise<string | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { data, error } = await supa.auth.admin.generateLink({ type: 'magiclink', email });
      const hashed = data?.properties?.hashed_token;
      if (!error && hashed) return hashed;
      console.error('auth-server: generateLink failed', attempt, error?.code, error?.message);
    } catch (e) {
      console.error('auth-server: generateLink threw', attempt, e);
    }
  }
  return null;
}

/** يستبدل token_hash بجلسة (مثل ما يفعل المتصفح بـ verifyOtp). */
export async function exchangeTokenHash(
  tokenHash: string,
): Promise<{ session: TokenSession; userId: string | null } | { session: null; code: string }> {
  try {
    const { data, error } = await anonClient().auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
    const session = data?.session ? toSession(data.session as unknown as Record<string, unknown>) : null;
    if (error || !session) return { session: null, code: error?.code || 'no_session' };
    return { session, userId: data.user?.id ?? null };
  } catch (e) {
    console.error('auth-server: verifyOtp threw', e);
    return { session: null, code: 'network_error' };
  }
}

/** رابط سحري ثم جلسة على السيرفر، مع إعادة واحدة لو سبق طلب آخر بنفس اللحظة. */
export async function mintSession(email: string, supa: SupabaseClient = adminClient()): Promise<TokenSession | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const hash = await mintMagicLinkHash(email, supa);
    if (!hash) return null;
    const r = await exchangeTokenHash(hash);
    if (r.session) return r.session;
    console.error('auth-server: token_hash exchange failed', attempt, r.code);
  }
  return null;
}

/* ───────────── رسائل عربية ───────────── */

const GOTRUE_MESSAGES: Record<string, string> = {
  invalid_credentials: 'بيانات الدخول غير صحيحة.',
  same_password: 'كلمة المرور الجديدة يجب أن تختلف عن الحالية.',
  weak_password: 'كلمة المرور ضعيفة، اختر كلمة أقوى فيها حروف وأرقام.',
  over_request_rate_limit: 'الخادم مشغول، حاول بعد قليل.',
  over_email_send_rate_limit: 'الخادم مشغول، حاول بعد قليل.',
  request_timeout: 'انتهت مهلة الطلب، حاول مرة ثانية.',
  network_error: 'تعذر الاتصال بخدمة الدخول، حاول بعد قليل.',
  user_banned: 'هذا الحساب موقوف، تواصل مع الدعم.',
  user_not_found: 'الحساب غير موجود.',
  email_not_confirmed: 'البريد الإلكتروني غير مؤكد بعد، ادخل برمز التحقق.',
  phone_not_confirmed: 'رقم الهاتف غير مؤكد بعد، ادخل برمز التحقق.',
  session_not_found: 'انتهت الجلسة، سجل دخول مرة ثانية.',
  session_expired: 'انتهت الجلسة، سجل دخول مرة ثانية.',
  bad_jwt: 'انتهت الجلسة، سجل دخول مرة ثانية.',
  no_authorization: 'سجل دخول أولا.',
  reauthentication_needed: 'لحماية حسابك سجل دخول من جديد ثم غير كلمة المرور.',
  reauth_nonce_missing: 'لحماية حسابك سجل دخول من جديد ثم غير كلمة المرور.',
  current_password_required: 'ادخل كلمة المرور الحالية.',
  otp_expired: 'انتهت صلاحية الرابط، حاول مرة ثانية.',
  validation_failed: 'البيانات غير صالحة.',
  email_exists: 'هذا البريد مستخدم في حساب آخر.',
  phone_exists: 'هذا الرقم مرتبط بحساب آخر بالفعل.',
};

export function gotrueMessage(code: string | null | undefined, fallback = 'حدث خطأ، حاول مرة ثانية.'): string {
  return (code && GOTRUE_MESSAGES[code]) || fallback;
}

/** حدود Supabase أو عطل عنده: ليست خطأ من الطالب. */
export function isGotrueBusy(f: GotrueFailure): boolean {
  return (
    f.status === 0 ||
    f.status === 429 ||
    f.status >= 500 ||
    f.code === 'over_request_rate_limit' ||
    f.code === 'request_timeout'
  );
}
