import { NextRequest } from 'next/server';
import { askOpenAIStream, type ChatHistoryMessage } from '@/lib/openai';
import { fetchRagContext, buildRagContext } from '@/lib/rag';
import { checkChatAccess } from '@/lib/subscription-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ChatPayload {
  // Full message list from the client. Last message is treated as the new user
  // question; everything before it is chat history.
  messages?: { role: 'user' | 'assistant'; content: string }[];
  // Single-question shortcut. Overrides `messages` when set.
  question?: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  subjectId?: string | null;
  subjectName?: string | null;
  /** Attached image as a data: URL (photo of a problem to solve). */
  imageDataUrl?: string | null;
}

// ~4MB of base64 ≈ 3MB image — plenty for a phone photo, small enough for
// one request body.
const MAX_IMAGE_DATA_URL_LENGTH = 4 * 1024 * 1024;
const IMAGE_DATA_URL_RE = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;

function badRequest(msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(req: NextRequest) {
  // Access control: only signed-in users with either an active subscription
  // OR remaining free-trial quota can talk to the AI.
  const access = await checkChatAccess(req);
  if (!access.allowed) {
    if (access.reason === 'banned') {
      return new Response(
        JSON.stringify({
          error: 'banned',
          message:
            'تم حظر حسابك من المنصة' +
            (access.banReason ? ` (السبب: ${access.banReason})` : '') +
            '. للاستفسار تواصل مع الدعم.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return new Response(
      JSON.stringify({
        error: access.reason ?? 'forbidden',
        message:
          access.reason === 'no_session'
            ? 'يجب تسجيل الدخول أولاً'
            : 'انتهت تجربتك المجانية. اشترك للاستمرار في استخدام الأستاذ ذكي.',
        upgrade_url: '/account/subscription',
      }),
      { status: 402, headers: { 'Content-Type': 'application/json' } },
    );
  }

  let body: ChatPayload;
  try {
    body = (await req.json()) as ChatPayload;
  } catch {
    return badRequest('Invalid JSON body');
  }

  let question = (body.question || '').trim();
  let history: ChatHistoryMessage[] = (body.history || []).map((m) => ({
    role: m.role,
    text: m.content,
  }));

  if (!question && Array.isArray(body.messages) && body.messages.length > 0) {
    const all = body.messages;
    const last = all[all.length - 1];
    if (!last || last.role !== 'user' || !last.content?.trim()) {
      return badRequest('Last message must be from user with non-empty content');
    }
    question = last.content.trim();
    history = all.slice(0, -1).map((m) => ({
      role: m.role,
      text: m.content,
    }));
  }

  // Attached image (optional). With an image, empty text is fine — the
  // model is asked to solve what's in the picture.
  let imageDataUrl: string | null = null;
  if (body.imageDataUrl) {
    if (
      typeof body.imageDataUrl !== 'string' ||
      body.imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH ||
      !IMAGE_DATA_URL_RE.test(body.imageDataUrl)
    ) {
      return badRequest('صورة غير صالحة أو أكبر من الحد المسموح');
    }
    imageDataUrl = body.imageDataUrl;
  }

  if (!question && !imageDataUrl) return badRequest('Missing question');

  // Best-effort RAG lookup. Empty result → falls back to general knowledge.
  // In demo mode we skip RAG entirely and feed the "platform intro" system
  // prompt below so the model never reveals curriculum content to non-paying
  // students.
  const demoMode = access.chatActive === false;
  let ragContext = '';
  if (demoMode) {
    ragContext = `
أنت "الأستاذ ذكي" في وضع التعريف بالمنصة. الطالب الحالي لم يشترك بعد.

قواعد صارمة:
1. لا تجاوب على أي سؤال له علاقة بالمنهج أو المواد أو الواجبات.
2. كلما سُئلت سؤال علمي، اعتذر بلطف وذكّر الطالب أن الإجابة المفصّلة تتطلب الاشتراك في باقة "الأستاذ ذكي - شهري" بسعر 25,000 د.ع.
3. اشرح للطالب أقسام المنصة الأربعة بإيجاز:
   - الأستاذ ذكي: دردشة نصية وصوتية تشرح المنهج خطوة بخطوة.
   - المكتبة: كتب وملخصات قابلة للتحميل.
   - المحاضرات: فيديوهات شرح من أساتذة معتمدين.
   - المنتدى: مكان لمناقشة الزملاء وتبادل الأسئلة.
4. ذكّر دائماً بأن المكتبة والمحاضرات والمنتدى تُفتح بدفعة واحدة فقط بـ 250,000 د.ع مدى الحياة.
5. الإجابة دائماً قصيرة (٢-٤ جمل) وبلهجة عراقية ودودة ومشجّعة.
6. لا تخترع أسعاراً أو ميزات. التزم بالأسعار والأقسام أعلاه فقط.
`;
  } else {
    try {
      const chunks = await fetchRagContext({
        question,
        subjectId: body.subjectId ?? null,
      });
      ragContext = buildRagContext(chunks);
    } catch {
      // Swallow RAG errors — chat must still work without curriculum data.
    }
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of askOpenAIStream({
          question,
          subjectName: body.subjectName ?? null,
          ragContext,
          history,
          // Demo mode refuses to answer curriculum questions anyway — sending
          // the attachment would bill vision tokens for a canned refusal, and
          // the free trial is currently open to every signed-in account.
          imageDataUrl: demoMode ? null : imageDataUrl,
        })) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'OpenAI error';
        controller.enqueue(encoder.encode(`\n[ERROR]: ${msg}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
