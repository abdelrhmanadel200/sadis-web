import { NextRequest } from 'next/server';
import { normalizeForTts } from '@/lib/tts-normalize';
import { checkChatAccess, consumeDailyAi, peekDailyAi, VOICE_DAILY_LIMIT } from '@/lib/subscription-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OPENAI_KEY = process.env.OPENAI_API_KEY!;
const CHAT_MODEL = 'gpt-4o-mini';
const STT_MODEL = 'whisper-1';
// gpt-4o-mini-tts is significantly more natural in Arabic than tts-1/tts-1-hd
// and supports an `instructions` field that lets us steer tone.
const TTS_MODEL = 'gpt-4o-mini-tts';
const TTS_VOICE = 'coral';
const TTS_INSTRUCTIONS =
  'تكلم بلهجة عراقية بسيطة ودافئة كأنك أستاذ مدرسة سادس إعدادي يشرح ' +
  'لطالبه. صوتك يجب يكون واضح، طبيعي، غير متسارع، وفيه نبرة تشجيعية. ' +
  'انطق الأرقام والمصطلحات العلمية بدقة. لا تتكلم بصوت روبوتي.';

const SYSTEM_PROMPT = `أنت "الأستاذ ذكي"، مساعد ذكاء اصطناعي تعليمي لطلبة سادس إعدادي في العراق.
ده محادثة صوتية. رد بجمل قصيرة (٢-٤ جمل بحد أقصى)، بدون قوائم أو نقاط، كأنك بتتكلم وجهاً لوجه.
استخدم لهجة عراقية بسيطة وودية. ولا تقول "هذا خارج المنهج" أبداً.`;

// تسجيل سؤال صوتي لا يحتاج أكثر من هذا (Whisper نفسه يقبل حتى 25MB، ويحاسب
// بالدقيقة، فالحد الصغير يحدد تكلفة الطلب الواحد).
const MAX_AUDIO_BYTES = 3 * 1024 * 1024;

// تسجيل طويل رجع بلا كلام يحسب من الحد، والضغطة القصيرة بالغلط لا تحسب.
// المدة من Whisper نفسه (هي ما يحاسب عليه)، والحجم احتياط لو لم ترجع.
const EMPTY_CHARGE_SECONDS = 30;
const EMPTY_CHARGE_BYTES = 256 * 1024;

type Turn = { role: 'user' | 'assistant'; content: string };

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function dailyLimitResponse() {
  return json(
    {
      error: 'daily_limit',
      message: `وصلت للحد اليومي (${VOICE_DAILY_LIMIT} أسئلة صوتية). يتجدد الحد الساعة 3 فجرا بتوقيت العراق.`,
    },
    429,
  );
}

/**
 * سجل المحادثة يأتي من المتصفح فلا نثق به: أدوار user/assistant فقط (بلا
 * رسائل system محقونة)، آخر 10 رسائل، وكل رسالة بحد 2000 حرف.
 */
function sanitizeHistory(raw: FormDataEntryValue | null): Turn[] {
  if (typeof raw !== 'string' || !raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(
      (m): m is Turn =>
        !!m &&
        typeof m === 'object' &&
        ((m as Turn).role === 'user' || (m as Turn).role === 'assistant') &&
        typeof (m as Turn).content === 'string',
    )
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
}

export async function POST(req: NextRequest) {
  // الصوت الحي جزء من الأستاذ ذكي: للمشتركين فقط، وبحد يومي مثل التطبيق.
  const access = await checkChatAccess(req);
  if (!access.allowed || !access.chatActive) {
    if (access.reason === 'banned') {
      return json({ error: 'banned', message: 'تم حظر حسابك من المنصة. للاستفسار تواصل مع الدعم.' }, 403);
    }
    if (access.reason === 'no_session') {
      return json({ error: 'no_session', message: 'سجل دخولك أولا لاستخدام الصوت الحي.' }, 401);
    }
    return json(
      {
        error: 'no_subscription',
        message: 'الصوت الحي متاح لمشتركي الأستاذ ذكي. فعل باقتك من صفحة الاشتراك.',
        upgrade_url: '/account/subscription',
      },
      402,
    );
  }

  try {
    const formData = await req.formData();
    const audio = formData.get('audio') as File | null;
    if (!audio) return json({ error: 'No audio' }, 400);
    if (audio.size > MAX_AUDIO_BYTES) {
      return json({ error: 'too_large', message: 'التسجيل طويل جدا، اختصر سؤالك وجرب مرة ثانية.' }, 413);
    }

    // من وصل للحد لا نرسل صوته لـ Whisper أصلا. قراءة فقط، والعد الذري بعد الرد.
    if ((await peekDailyAi(access, 'voice_count', VOICE_DAILY_LIMIT)) === 'limit') {
      return dailyLimitResponse();
    }

    // 1. STT (Whisper)
    const sttForm = new FormData();
    sttForm.append('file', audio, 'voice.webm');
    sttForm.append('model', STT_MODEL);
    sttForm.append('language', 'ar');
    // verbose_json يرجع duration مع النص.
    sttForm.append('response_format', 'verbose_json');

    const sttRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_KEY}` },
      body: sttForm,
    });
    if (!sttRes.ok) {
      const t = await sttRes.text();
      return json({ error: 'STT failed', detail: t }, 500);
    }
    const sttData = await sttRes.json();
    const transcript = (sttData.text || '').trim();
    if (!transcript) {
      // بدون هذا، رفع صوت طويل بلا كلام يتكرر بتكلفة Whisper ولا يصل للحد أبدا.
      const seconds = sttData.duration;
      const longUpload =
        typeof seconds === 'number' && Number.isFinite(seconds)
          ? seconds > EMPTY_CHARGE_SECONDS
          : audio.size > EMPTY_CHARGE_BYTES;
      if (longUpload) await consumeDailyAi(access, 'voice_count', VOICE_DAILY_LIMIT);
      return json({ error: 'empty', message: 'ما سمعت أي شي، جرب تاني' }, 400);
    }

    // 2. GPT-4o mini chat
    const history = sanitizeHistory(formData.get('history'));

    const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...history,
          { role: 'user', content: transcript },
        ],
        temperature: 0.6,
        max_tokens: 250,
      }),
    });
    if (!chatRes.ok) {
      const t = await chatRes.text();
      return json({ error: 'Chat failed', detail: t }, 500);
    }
    const chatData = await chatRes.json();
    const reply = (chatData.choices?.[0]?.message?.content || '').trim();
    if (!reply) {
      return json({ error: 'empty reply' }, 500);
    }

    // يحسب السؤال بعد وجود رد فعلي وقبل TTS، ففشل OpenAI قبله لا يضيع من الحد.
    // العداد ذري في القاعدة، فالطلبات المتوازية لا تتجاوز الحد.
    const usage = await consumeDailyAi(access, 'voice_count', VOICE_DAILY_LIMIT);
    if (usage === 'limit') {
      return dailyLimitResponse();
    }

    // 3. TTS: لو فشل الصوت نرجع النص بدون صوت بدل ما يضيع الرد المحسوب.
    try {
      const ttsRes = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: TTS_MODEL,
          voice: TTS_VOICE,
          input: normalizeForTts(reply),
          response_format: 'mp3',
          instructions: TTS_INSTRUCTIONS,
        }),
      });
      if (!ttsRes.ok) {
        const t = await ttsRes.text().catch(() => '');
        console.error('TTS failed', ttsRes.status, t);
        return json({ transcript, reply, audio: null }, 200);
      }
      const audioBytes = await ttsRes.arrayBuffer();
      const audioBase64 = Buffer.from(audioBytes).toString('base64');

      return json({ transcript, reply, audio: audioBase64 }, 200);
    } catch (ttsErr: unknown) {
      console.error('TTS failed', ttsErr);
      return json({ transcript, reply, audio: null }, 200);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    return json({ error: msg }, 500);
  }
}
