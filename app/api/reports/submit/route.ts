// POST /api/reports/submit
//
// Body: { kind: 'lecture' | 'book' | 'library_file', item_id: uuid, reason: string, details?: string }
//
// Lets any authenticated user flag a piece of content for moderator review.
// Mostly used for copyright complaints — this is the mechanism the client
// specifically asked for so they can act on takedown requests fast.

import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const VALID_KINDS = ['lecture', 'book', 'library_file'] as const;
const VALID_REASONS = ['copyright', 'inappropriate', 'spam', 'other'] as const;

function bad(message: string, status = 400) {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(req: NextRequest) {
  // Resolve user from cookies OR Bearer header.
  let userId: string | null = null;

  const auth = req.headers.get('authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7);
    try {
      const anon = createClient(SUPABASE_URL, ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data } = await anon.auth.getUser(token);
      userId = data.user?.id ?? null;
    } catch {/* ignore */}
  }
  if (!userId) {
    const cookieStore = await cookies();
    const userClient = createServerClient(SUPABASE_URL, ANON_KEY, {
      cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
    });
    const { data } = await userClient.auth.getUser();
    userId = data.user?.id ?? null;
  }
  if (!userId) return bad('يجب تسجيل الدخول لإرسال البلاغ', 401);

  let body: { kind?: string; item_id?: string; reason?: string; details?: string };
  try {
    body = await req.json();
  } catch {
    return bad('JSON body مطلوب');
  }

  const kind = body.kind;
  const itemId = body.item_id?.trim();
  const reason = body.reason?.trim() || 'other';
  const details = (body.details ?? '').trim().slice(0, 1000);

  if (!kind || !VALID_KINDS.includes(kind as never)) {
    return bad('نوع المحتوى غير صالح');
  }
  if (!itemId) return bad('معرّف المحتوى مطلوب');
  if (!VALID_REASONS.includes(reason as never)) {
    return bad('السبب غير صالح');
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // Reject duplicate reports from the same user on the same item.
  const { data: existing } = await admin
    .from('content_reports')
    .select('id')
    .eq('reporter_id', userId)
    .eq('kind', kind)
    .eq('item_id', itemId)
    .maybeSingle();
  if (existing) {
    return new Response(
      JSON.stringify({ ok: true, already_reported: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const { error: insertErr } = await admin.from('content_reports').insert({
    reporter_id: userId,
    kind,
    item_id: itemId,
    reason,
    details: details || null,
  });
  if (insertErr) {
    console.error('content_reports insert error', insertErr);
    return bad('تعذّر إرسال البلاغ', 500);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
