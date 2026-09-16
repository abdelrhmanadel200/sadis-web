// POST /api/phone-otp/link
//
// يربط رقم موبايل بحساب موجود (سجّل بالإيميل أو جوجل) بعد التحقق من رمز
// OTP أُرسل إليه عبر /api/phone-otp/send.
//
// Body: { phone: string, code: string }
// Auth: Authorization: Bearer <access_token> لصاحب الحساب.
//
// بعد الربط يستطيع الطالب الدخول برقمه أيضاً: مسار /verify يبحث عن الحساب
// برقم الهاتف، ويُصدر له جلسة بدون المساس بكلمة مروره.

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { adminClient, hashCode, normalizePhone } from '@/lib/phone-otp';
import { findLoginUser } from '@/lib/auth-server';

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
  // رقم يبدأ بصفر لن يطابقه الدخول بالهاتف أبداً (يُخزَّن دائماً بمفتاح الدولة).
  if (!/^[0-9]{10,15}$/.test(phone) || phone.startsWith('0') || !/^[0-9]{4}$/.test(code)) {
    return bad('رقم الهاتف أو الرمز غير صالح');
  }

  const supa = adminClient();

  // ١) احجز محاولة بشكل ذري قبل مقارنة الرمز، فالطلبات المتوازية لا تتجاوز
  //    5 محاولات لكل رمز.
  const { data: claimed, error: claimErr } = await supa.rpc('otp_claim_attempt', { p_phone: phone });
  if (claimErr) return bad('خطأ في قاعدة البيانات', 500);
  const row = (claimed as { id: string; code_hash: string }[] | null)?.[0];
  if (!row) return bad('انتهت صلاحية الرمز أو تجاوزت عدد المحاولات، اطلب رمزاً جديداً', 429);
  if (row.code_hash !== hashCode(code)) return bad('الرمز غير صحيح', 401);

  // ٢) الرقم لا يجوز أن يكون مرتبطاً بحساب آخر. نفحص قبل حرق الرمز حتى لا
  //    يضيع رمز صحيح بسبب خطأ في البحث.
  const found = await findLoginUser(supa, { phone });
  if (!found.ok) {
    console.error('phone-otp/link: auth_find_login_user failed', found.error);
    return bad('خطأ في البحث عن المستخدم', 500);
  }
  if (found.user && found.user.id !== userId) return bad('هذا الرقم مرتبط بحساب آخر بالفعل', 409);

  // الرقم القديم في البروفايل، للتراجع لو فشل ربط حساب الدخول.
  const { data: prof, error: profReadErr } = await supa
    .from('profiles')
    .select('phone')
    .eq('id', userId)
    .maybeSingle();
  if (profReadErr) return bad('خطأ في قاعدة البيانات', 500);
  const oldPhone = (prof?.phone as string | null) ?? null;

  // ٣) احرق الرمز: طلب واحد فقط يستطيع استعمال الرمز الصحيح.
  const { data: burned, error: burnErr } = await supa
    .from('phone_otp_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', row.id)
    .is('consumed_at', null)
    .select('id');
  if (burnErr) return bad('خطأ في قاعدة البيانات', 500);
  if (!burned || burned.length === 0) return bad('الرمز مستخدم، اطلب رمزاً جديداً', 409);

  // عند فشل من جهة الخادم بعد الحرق نرجع الرمز صالحا، فيستطيع الطالب إعادة المحاولة.
  const unburn = async () => {
    const { error } = await supa.from('phone_otp_codes').update({ consumed_at: null }).eq('id', row.id);
    if (error) console.error('phone-otp/link: unburn failed', error);
  };

  // ٤) البروفايل أولاً (القيد UNIQUE يمنع رقماً مكرراً)، ثم حساب الدخول.
  const { error: profErr } = await supa.from('profiles').update({ phone }).eq('id', userId);
  if (profErr) {
    if (profErr.code === '23505') return bad('هذا الرقم مرتبط بحساب آخر بالفعل', 409);
    console.error('phone-otp/link: profile update failed', profErr);
    await unburn();
    return bad('تعذّر ربط الرقم، حاول مرة ثانية', 500);
  }

  const upd = await supa.auth.admin.updateUserById(userId, { phone, phone_confirm: true });
  if (upd.error) {
    console.error('phone-otp/link: updateUserById failed', upd.error);
    const { error: rollbackErr } = await supa.from('profiles').update({ phone: oldPhone }).eq('id', userId);
    if (rollbackErr) console.error('phone-otp/link: profile rollback failed', rollbackErr);
    // حساب آخر أخذ الرقم بعد الفحص أعلاه: إعادة المحاولة لن تنجح.
    if (upd.error.code === 'phone_exists') return bad('هذا الرقم مرتبط بحساب آخر بالفعل', 409);
    await unburn();
    return bad('تعذّر ربط الرقم، حاول مرة ثانية', 500);
  }

  return new Response(JSON.stringify({ ok: true, phone }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
