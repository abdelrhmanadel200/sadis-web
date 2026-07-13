// One-click unsubscribe endpoint referenced by the `List-Unsubscribe` header.
//
// Gmail and other major providers REQUIRE a working one-click unsubscribe
// when the `List-Unsubscribe-Post: List-Unsubscribe=One-Click` header is
// present. Supports both POST (one-click) and GET (clickable link in the
// footer) so it works whether the recipient clicked or their mail client
// auto-handled it.
//
// We mark the address as unsubscribed in `email_unsubscribes`. The webhook
// + cron sender check that table before each send.

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function html(body: string, status = 200) {
  return new Response(
    `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>إلغاء الاشتراك</title></head><body style="font-family:sans-serif;max-width:500px;margin:80px auto;padding:24px;text-align:center;color:#1a202c;">${body}</body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

async function unsubscribe(email: string): Promise<boolean> {
  if (!email.includes('@')) return false;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });
  await admin.from('email_unsubscribes').upsert({ email: email.toLowerCase() });
  return true;
}

export async function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get('to') ?? '';
  const ok = await unsubscribe(to);
  if (!ok) return html('<h2>عنوان البريد الإلكتروني غير صالح</h2>', 400);
  return html(
    `<h2 style="color:#0369a1;">تم إلغاء الاشتراك</h2>
     <p>لن تستلم رسائل أخرى من سادس ألترا.</p>
     <p style="font-size:14px;color:#64748b;margin-top:24px;">إذا كان ذلك عن طريق الخطأ، فتواصل معنا على <a href="mailto:support@6thultra.com">support@6thultra.com</a>.</p>`,
  );
}

export async function POST(req: NextRequest) {
  // One-click unsub: Gmail/Outlook hit this with no body needed.
  const to = req.nextUrl.searchParams.get('to') ?? '';
  await unsubscribe(to);
  return new Response('ok', { status: 200 });
}
