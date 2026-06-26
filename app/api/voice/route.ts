import { NextRequest } from 'next/server';
import { normalizeForTts } from '@/lib/tts-normalize';

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

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audio = formData.get('audio') as File | null;
    const historyJson = formData.get('history') as string | null;
    if (!audio) {
      return new Response(JSON.stringify({ error: 'No audio' }), { status: 400 });
    }

    // 1. STT (Whisper)
    const sttForm = new FormData();
    sttForm.append('file', audio, 'voice.webm');
    sttForm.append('model', STT_MODEL);
    sttForm.append('language', 'ar');

    const sttRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_KEY}` },
      body: sttForm,
    });
    if (!sttRes.ok) {
      const t = await sttRes.text();
      return new Response(JSON.stringify({ error: 'STT failed', detail: t }), { status: 500 });
    }
    const sttData = await sttRes.json();
    const transcript = (sttData.text || '').trim();
    if (!transcript) {
      return new Response(JSON.stringify({ error: 'empty', message: 'ما سمعت أي شي، جرب تاني' }), { status: 400 });
    }

    // 2. GPT-4o mini chat
    const history: { role: 'user' | 'assistant'; content: string }[] = [];
    if (historyJson) {
      try { history.push(...JSON.parse(historyJson)); } catch {}
    }

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
      return new Response(JSON.stringify({ error: 'Chat failed', detail: t }), { status: 500 });
    }
    const chatData = await chatRes.json();
    const reply = (chatData.choices?.[0]?.message?.content || '').trim();
    if (!reply) {
      return new Response(JSON.stringify({ error: 'empty reply' }), { status: 500 });
    }

    // 3. TTS-1 speech synthesis
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
      const t = await ttsRes.text();
      return new Response(JSON.stringify({ error: 'TTS failed', detail: t }), { status: 500 });
    }
    const audioBytes = await ttsRes.arrayBuffer();
    const audioBase64 = Buffer.from(audioBytes).toString('base64');

    return new Response(
      JSON.stringify({ transcript, reply, audio: audioBase64 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}
