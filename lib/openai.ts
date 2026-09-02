// OpenAI API client — used server-side only.
// The API key is read from process.env.OPENAI_API_KEY and must NEVER ship to the
// browser. All client-side chat traffic should go through /api/chat which calls
// these helpers from the Node runtime.

const MODEL = 'gpt-4o-mini';
const BASE_URL = 'https://api.openai.com/v1/chat/completions';

// Content is a plain string for text-only turns, or a parts array when the
// student attaches an image (gpt-4o-mini is multimodal).
export type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | OpenAIContentPart[];
}

// Public chat-history shape used by the front-end. Keeping the same shape and
// name as the old GeminiMessage so callers needing the wire format stay simple.
export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  text: string;
}

const FORMATTING_RULES = `قواعد التنسيق (مهمة جداً):
- استخدم Markdown دائماً.
- العناوين الفرعية بـ ## أو ###، الكلمات المهمة بـ **عريض**.
- اللي يحتاج خطوات اعرضه كقائمة مرقمة (1. 2. 3.).
- اللي يحتاج تعداد بسيط بـ -.
- المعادلات والرموز الرياضية اكتبها بصيغة LaTeX داخل $ ... $ للسطر، أو $$ ... $$ للمعادلات الكبيرة.
- الكسور اكتبها \\\\frac{a}{b}، الأسس a^{n}، الجذر \\\\sqrt{x}، حروف يونانية \\\\alpha \\\\beta \\\\theta \\\\pi.
- الأرقام والمتغيرات اللاتينية اعرضها داخل $ ... $ حتى لو منفردة (مثل $x$، $5$، $\\\\pi$) عشان تتعرض بخط واضح.
- الأكواد البرمجية أو الصيغ النصية بين \`\`\`.
- لا تكتب رموز الـ Markdown نفسها كنص (مثل \`**\` أو \`#\`) داخل الجمل.`;

function buildSystemInstruction(
  subjectName?: string | null,
  ragContext?: string | null,
): string {
  const hasRag = !!ragContext && ragContext.trim().length > 0;
  const subjectLine =
    subjectName && subjectName !== 'عام'
      ? `المادة الحالية: ${subjectName}.`
      : '';

  if (hasRag) {
    return `أنت "الأستاذ ذكي"، معلم ذكاء اصطناعي متخصص في منهج سادس إعدادي العراقي.
${subjectLine}

اعتمد على المقتطفات التالية المأخوذة من المنهج الوزاري لتجاوب على السؤال. لو الإجابة موجودة فيها، اقتبس منها بأسلوبك. لو السؤال له علاقة بالمادة بس مش موجود حرفياً في المقتطفات، اشرح من معرفتك العامة بأسلوب يناسب طالب سادس إعدادي.

قواعد الإجابة:
- رد بالعربية بلهجة عراقية بسيطة وواضحة.
- اشرح خطوة بخطوة لما السؤال يحتاج ذلك.
- استخدم أمثلة لما المفهوم يكون صعب.
- لا تقول "هذا خارج المنهج" أبداً. لو السؤال بعيد عن المادة، وضّحه بلطف وأرشد الطالب.

${FORMATTING_RULES}

محتوى المنهج المتاح:
${ragContext}`;
  }

  if (!subjectName || subjectName === 'عام') {
    return `أنت "الأستاذ ذكي"، مساعد ذكاء اصطناعي تعليمي لطلبة سادس إعدادي في العراق.
- رد بالعربية بلهجة عراقية بسيطة واضحة.
- اشرح بطريقة سهلة ومنظمة، خطوة بخطوة.
- استخدم الأمثلة لما المفهوم يكون صعب.
- جاوب على أي سؤال تعليمي بأفضل ما عندك. لا تقول "هذا خارج المنهج".
- لو السؤال غامض اطلب توضيح بدل ما ترفضه.

${FORMATTING_RULES}`;
  }
  return `أنت "الأستاذ ذكي"، معلم ذكاء اصطناعي متخصص في منهج سادس إعدادي العراقي.
- ${subjectLine}
- رد بالعربية بلهجة عراقية بسيطة مناسبة للطالب.
- اشرح الإجابة خطوة بخطوة لو كان السؤال يحتاج ذلك.
- لو السؤال له علاقة بالمادة بس مش حرفياً في المنهج، اشرح بمعرفتك العامة بأسلوب تعليمي. لا تقول "هذا خارج المنهج" إلا لو السؤال بعيد تماماً عن المادة.
- استخدم الأمثلة لما المفهوم يكون صعب.

${FORMATTING_RULES}`;
}

export interface AskOptions {
  question: string;
  subjectName?: string | null;
  ragContext?: string | null;
  history?: ChatHistoryMessage[];
  /** Optional attached image as a data: URL (e.g. a photo of a problem). */
  imageDataUrl?: string | null;
}

function buildMessages({
  question,
  subjectName,
  ragContext,
  history = [],
  imageDataUrl,
}: AskOptions): OpenAIMessage[] {
  const messages: OpenAIMessage[] = [
    { role: 'system', content: buildSystemInstruction(subjectName, ragContext) },
  ];
  for (const m of history) {
    messages.push({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.text,
    });
  }
  if (imageDataUrl) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: question || 'حل السؤال الموجود في الصورة وشرحه خطوة بخطوة.' },
        { type: 'image_url', image_url: { url: imageDataUrl } },
      ],
    });
  } else {
    messages.push({ role: 'user', content: question });
  }
  return messages;
}

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY || '';
  if (!key) throw new Error('OPENAI_API_KEY is not configured');
  return key;
}

// Non-streaming chat completion.
export async function askOpenAI(opts: AskOptions): Promise<string> {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: buildMessages(opts),
      temperature: 0.4,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${txt}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? '';
  return text || 'عذراً، لم أتمكن من الإجابة. حاول مرة أخرى.';
}

// Streaming chat completion via SSE.
export async function* askOpenAIStream(
  opts: AskOptions
): AsyncGenerator<string, void, unknown> {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: buildMessages(opts),
      temperature: 0.4,
      max_tokens: 2048,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const txt = await res.text().catch(() => '');
    throw new Error(`OpenAI stream error ${res.status}: ${txt}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      if (payload === '[DONE]') return;
      try {
        const data = JSON.parse(payload);
        const delta = data?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta.length > 0) yield delta;
      } catch {
        // skip malformed lines
      }
    }
  }
}
