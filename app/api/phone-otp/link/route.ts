// POST /api/phone-otp/link
//
// يربط رقم موبايل بحساب موجود (سجّل بالإيميل أو جوجل) بعد التحقق من رمز
// OTP أُرسل إليه عبر /api/phone-otp/send.
//
// Body: { phone: string, code: string }
// Auth: Authorization: Bearer <access_token> لصاحب الحساب.
//
// بعد الربط يستطيع الطالب الدخول برقمه أيضاً: مسار /verify يبحث عن الحساب
// برقم الهاتف قبل الإيميل الاصطناعي، ويُصدر له جلسة بدون المساس بكلمة مروره.

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { adminClient, hashCode, normalizePhone } from '@/lib/phone-otp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function bad(message: string, status = 400) {
  return new Response(JSON.stringify({ ok: false, message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(req: NextRequest) {
  // من هو المستخدم؟
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) return bad('سجّل دخول أولاً', 401);
  const token = auth.slice(7).trim();
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userRes.user) return bad('سجّل دخول أولاً', 401);
  const userId = userRes.user.id;

  let body: { phone?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return bad('JSON غير صالح');
  }
  const phone = normalizePhone((body.phone || '').trim());
  const code = (body.code || '').trim();
  if (!/^[0-9]{10,15}$/.test(phone) || !/^[0-9]{4}$/.test(code)) {
    return bad('رقم الهاتف أو الرمز غير صالح');
  }

  const supa = adminClient();

  // ١) تحقق من الرمز (نفس قواعد مسار الدخول: آخر رمز غير مستهلك، 5 محاولات).
  const { data: rows, error: fetchErr } = await supa
    .from('phone_otp_codes')
    .select('*')
    .eq('phone', phone)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1);
  if (fetchErr) return bad('خطأ في قاعدة البيانات', 500);
  const row = rows?.[0];
  if (!row) return bad('لا يوجد رمز نشط، اطلب رمز جديد', 404);
  if (new Date(row.expires_at).getTime() < Date.now()) return bad('انتهت صلاحية الرمز، اطلب رمز جديد', 410);
  if ((row.attempts ?? 0) >= 5) return bad('محاولات كثيرة، اطلب رمز جديد', 429);
  if (row.code_hash !== hashCode(code)) {
    await supa.from('phone_otp_codes').update({ attempts: (row.attempts ?? 0) + 1 }).eq('id', row.id);
    return bad('الرمز غير صحيح', 401);
  }

  // ٢) الرقم لا يجوز أن يكون مرتبطاً بحساب آخر.
  let page = 1;
  while (page < 50) {
    const { data, error } = await supa.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return bad('خطأ في البحث عن المستخدم', 500);
    const taken = data.users.find((u) => u.phone === phone && u.id !== userId);
    if (taken) return bad('هذا الرقم مرتبط بحساب آخر بالفعل', 409);
    if (data.users.length < 200) break;
    page += 1;
  }

  // ٣) اربط الرقم بحساب المصادقة وبالبروفايل.
  const upd = await supa.auth.admin.updateUserById(userId, { phone, phone_confirm: true });
  if (upd.error) return bad('تعذّر ربط الرقم: ' + upd.error.message, 500);
  await supa.from('profiles').update({ phone }).eq('id', userId);

  // ٤) احرق الرمز بعد النجاح فقط.
  await supa.from('phone_otp_codes').update({ consumed_at: new Date().toISOString() }).eq('id', row.id);

  return new Response(JSON.stringify({ ok: true, phone }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
