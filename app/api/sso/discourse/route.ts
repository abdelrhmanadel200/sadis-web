// /api/sso/discourse — DiscourseConnect SSO endpoint
//
// Discourse hits us with `?sso=<base64>&sig=<hex>` when a visitor tries to
// log into forum.6thultra.com. We:
//   1. Verify the signature (HMAC-SHA256 against DISCOURSE_SSO_SECRET).
//   2. Resolve the current Supabase user from one of: Authorization header,
//      `sb-access-token` cookie, or SSR cookie session.
//   3. Sign a payload with their id/email/username and redirect the browser
//      back to forum.6thultra.com/session/sso_login?sso=…&sig=…
//
// Two response modes:
//   - GET: server-issued 302 redirect (used when cookies already carry the
//     session, or as the final hop after the bridge sets a cookie).
//   - POST: JSON `{ redirect_url }` — used by the client-side bridge
//     (/sso/discourse) which holds the access_token in localStorage and
//     can attach a Bearer header. The bridge then performs the navigation.
//
// The POST path avoids a previously seen infinite loop where the bridge
// tried fetch(GET, { redirect:'manual' }) and the browser returned an
// `opaqueredirect` we couldn't follow.

import { NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
const SSO_SECRET = (process.env.DISCOURSE_SSO_SECRET || '').trim();
const FORUM_BASE = (process.env.DISCOURSE_FORUM_URL || 'https://forum.6thultra.com').trim();
const APP_BASE = (process.env.APP_BASE_URL || 'https://www.6thultra.com').trim();

function hmac(payload: string): string {
  return createHmac('sha256', SSO_SECRET).update(payload).digest('hex');
}

function verifySignature(sso: string, sig: string): boolean {
  if (!SSO_SECRET) return false;
  const expected = hmac(sso);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(sig, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

interface ResolvedUser {
  userId: string;
  email: string;
  meta: Record<string, unknown>;
}

async function resolveUserFromToken(token: string): Promise<ResolvedUser | null> {
  try {
    const anon = createServerClient(SUPABASE_URL, ANON_KEY, {
      cookies: { getAll: () => [], setAll: () => {} },
    });
    const { data } = await anon.auth.getUser(token);
    if (!data.user) return null;
    return {
      userId: data.user.id,
      email: data.user.email ?? '',
      meta: (data.user.user_metadata as Record<string, unknown>) ?? {},
    };
  } catch {
    return null;
  }
}

async function resolveUser(req: NextRequest): Promise<ResolvedUser | null> {
  // 1. Authorization: Bearer <token>
  const authHeader = req.headers.get('authorization') ?? '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const u = await resolveUserFromToken(authHeader.slice(7).trim());
    if (u) return u;
  }

  // 2. sb-access-token cookie (custom, set by the bridge when present).
  const cookieStore = await cookies();
  const sbToken =
    cookieStore.get('sb-access-token')?.value ||
    cookieStore.get('sb-token')?.value;
  if (sbToken) {
    const u = await resolveUserFromToken(sbToken);
    if (u) return u;
  }

  // 3. SSR cookie session (Supabase auth-helpers / @supabase/ssr).
  try {
    const userClient = createServerClient(SUPABASE_URL, ANON_KEY, {
      cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
    });
    const { data } = await userClient.auth.getUser();
    if (data.user) {
      return {
        userId: data.user.id,
        email: data.user.email ?? '',
        meta: (data.user.user_metadata as Record<string, unknown>) ?? {},
      };
    }
  } catch {/* fall through */}

  return null;
}

interface SsoResult {
  ok: true;
  redirect_url: string;
}
interface SsoError {
  ok: false;
  status: number;
  message: string;
  /** Set when the caller should send the user through the client-side bridge. */
  bridge_url?: string;
}

async function buildSso(
  req: NextRequest,
  sso: string,
  sig: string,
): Promise<SsoResult | SsoError> {
  if (!sso || !sig) return { ok: false, status: 400, message: 'Missing sso/sig' };
  if (!SSO_SECRET) return { ok: false, status: 503, message: 'SSO not configured' };
  if (!verifySignature(sso, sig)) {
    return { ok: false, status: 403, message: 'Invalid signature' };
  }

  const user = await resolveUser(req);
  if (!user) {
    return {
      ok: false,
      status: 401,
      message: 'No session',
      bridge_url: `${APP_BASE}/sso/discourse?sso=${encodeURIComponent(sso)}&sig=${encodeURIComponent(sig)}`,
    };
  }

  const decoded = Buffer.from(sso, 'base64').toString('utf-8');
  const nonceParams = new URLSearchParams(decoded);
  const nonce = nonceParams.get('nonce');
  const returnSsoUrl =
    nonceParams.get('return_sso_url') ?? `${FORUM_BASE}/session/sso_login`;
  if (!nonce) return { ok: false, status: 400, message: 'Bad payload (no nonce)' };

  const profileEmail = user.email || '';
  const shortId = user.userId.slice(0, 8);
  const usernameSource =
    (user.meta.username as string) ||
    profileEmail.split('@')[0] ||
    `u_${shortId}`;
  const username =
    usernameSource
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 20) || `u_${shortId}`;
  const name = (user.meta.name as string) || username;

  const payload = new URLSearchParams({
    nonce,
    external_id: user.userId,
    email: profileEmail,
    username,
    name,
    require_activation: 'false',
    suppress_welcome_message: 'true',
  });
  const avatarUrl = user.meta.avatar_url as string | undefined;
  if (avatarUrl) payload.set('avatar_url', avatarUrl);

  const encoded = Buffer.from(payload.toString(), 'utf-8').toString('base64');
  const signature = hmac(encoded);

  const back = new URL(returnSsoUrl);
  back.searchParams.set('sso', encoded);
  back.searchParams.set('sig', signature);

  return { ok: true, redirect_url: back.toString() };
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const sso = url.searchParams.get('sso') ?? '';
  const sig = url.searchParams.get('sig') ?? '';

  const result = await buildSso(req, sso, sig);
  if (result.ok) return Response.redirect(result.redirect_url, 302);
  if (result.bridge_url) return Response.redirect(result.bridge_url, 302);
  return new Response(result.message, { status: result.status });
}

export async function POST(req: NextRequest) {
  // JSON variant used by the client-side bridge so it can navigate without
  // tripping the browser's opaqueredirect behaviour on manual fetch.
  let body: { sso?: string; sig?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, message: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const result = await buildSso(req, body.sso ?? '', body.sig ?? '');
  const status = result.ok ? 200 : result.status;
  return new Response(JSON.stringify(result), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
