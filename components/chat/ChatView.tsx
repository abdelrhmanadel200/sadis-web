'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Send, ChevronDown, BookOpen, Mic } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/providers/AuthProvider';
interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}
import { DEFAULT_SUBJECTS, getSubjectById } from '@/lib/subjects';
import type { ChatMessage as ChatMessageRow } from '@/lib/types';
import ChatMessage from './ChatMessage';

interface LocalMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
  /**
   * Supabase `chat_messages.id` for the saved row. Populated on assistant
   * bubbles after we persist them so the feedback buttons can target the
   * right message. Null while streaming.
   */
  dbId?: string | null;
}

interface Props {
  subjectId?: string | null;
}

export default function ChatView({ subjectId: fixedSubjectId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const sessionParam = searchParams.get('session');
  const [sessionId, setSessionId] = useState<string | null>(sessionParam);

  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [subjectId, setSubjectId] = useState<string | null>(fixedSubjectId ?? null);
  const [subjectPickerOpen, setSubjectPickerOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const subjectPickerRef = useRef<HTMLDivElement | null>(null);
  // Tracks sessions that we created locally so we don't reload them from DB
  // mid-stream and clobber the in-flight assistant message.
  const localSessionsRef = useRef<Set<string>>(new Set());

  // Close subject picker when clicking outside.
  useEffect(() => {
    if (!subjectPickerOpen) return;
    function handler(e: MouseEvent) {
      if (subjectPickerRef.current && !subjectPickerRef.current.contains(e.target as Node)) {
        setSubjectPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [subjectPickerOpen]);

  const subject = useMemo(() => getSubjectById(subjectId), [subjectId]);

  // Reset when fixedSubjectId changes (navigating between /chat/[id])
  useEffect(() => {
    setSubjectId(fixedSubjectId ?? null);
  }, [fixedSubjectId]);

  // Load an existing session if session param is set.
  // CRITICAL: skip reload for sessions we just created locally — otherwise
  // the in-flight assistant message gets overwritten with the DB snapshot
  // (which doesn't have it yet) and the user thinks the bot didn't reply.
  useEffect(() => {
    if (!user) return;
    const sid = searchParams.get('session');

    // Locally-created session — keep our local state, just sync sessionId.
    if (sid && localSessionsRef.current.has(sid)) {
      setSessionId(sid);
      return;
    }

    setSessionId(sid);
    if (!sid) {
      setMessages([]);
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sid)
        .order('created_at', { ascending: true });
      if (error) {
        console.error(error);
        return;
      }
      const rows = (data as ChatMessageRow[]) || [];
      setMessages(
        rows.map((r) => ({
          id: r.id,
          role: r.role,
          content: r.content,
          // For messages loaded from DB, the local id IS the DB id, so
          // feedback buttons appear immediately on restored conversations.
          dbId: r.role === 'assistant' ? r.id : null,
        }))
      );

      // Derive subject from session
      const { data: sessRow } = await supabase
        .from('chat_sessions')
        .select('subject_id')
        .eq('id', sid)
        .single();
      if (sessRow?.subject_id) setSubjectId(sessRow.subject_id);
    })();
  }, [user, searchParams]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  // Autosize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [input]);

  const createSessionIfNeeded = useCallback(
    async (firstMessage: string): Promise<string | null> => {
      if (sessionId) return sessionId;
      if (!user) return null;

      const title =
        firstMessage.trim().slice(0, 60) +
        (firstMessage.length > 60 ? '...' : '');

      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: user.id,
          subject_id: subjectId,
          title,
        })
        .select()
        .single();

      if (error || !data) {
        console.error('create session failed', error);
        return null;
      }
      // Mark this session as locally created BEFORE updating URL so the
      // load-effect knows to keep our local messages.
      localSessionsRef.current.add(data.id);
      setSessionId(data.id);
      // Update URL without full navigation
      const qp = new URLSearchParams(searchParams.toString());
      qp.set('session', data.id);
      router.replace(
        `${fixedSubjectId ? `/chat/${fixedSubjectId}` : '/chat'}?${qp.toString()}`,
        { scroll: false }
      );
      return data.id;
    },
    [sessionId, user, subjectId, searchParams, router, fixedSubjectId]
  );

  const saveMessage = useCallback(
    async (
      sid: string,
      role: 'user' | 'assistant',
      content: string
    ): Promise<string | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          session_id: sid,
          user_id: user.id,
          subject_id: subjectId,
          role,
          content,
        })
        .select('id')
        .single();
      if (error) console.error('save message error', error);
      // Touch session updated_at
      await supabase
        .from('chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sid);
      return (data?.id as string | undefined) ?? null;
    },
    [user, subjectId]
  );

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: LocalMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    };
    const botMsg: LocalMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      pending: true,
    };

    setMessages((m) => [...m, userMsg, botMsg]);
    setInput('');
    setSending(true);

    // Prepare history for OpenAI (before the new user msg)
    const history: HistoryMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Ensure session & persist user message
    const sid = await createSessionIfNeeded(text);
    if (sid) await saveMessage(sid, 'user', text);

    let fullText = '';
    try {
      // Attach the current Supabase session token so the server-side
      // subscription guard can identify the user even when no cookie session
      // is present (web client uses localStorage persistence by default).
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          question: text,
          subjectId: subjectId,
          subjectName: subject?.name_ar ?? null,
          history,
        }),
      });

      if (!res.ok || !res.body) {
        // Try to read a structured error so we can surface an actionable
        // message (e.g. 402 → "اشترك" with a link inside the bubble).
        let parsed: { error?: string; message?: string; upgrade_url?: string } | null = null;
        try {
          const txt = await res.text();
          parsed = txt ? JSON.parse(txt) : null;
        } catch {/* not JSON */}

        if (res.status === 402 || res.status === 401) {
          const upgradeUrl = parsed?.upgrade_url || '/account/subscription';
          const body =
            parsed?.message ||
            'انتهت تجربتك المجانية. اشترك للاستمرار في استخدام الأستاذ ذكي.';
          // ChatMessage renderer recognises [ACTION:<href>|<label>] and turns
          // it into an inline button — no chat-engine logic leaks into the UI.
          const msg = `${body}\n\n[ACTION:${upgradeUrl}|اشترك الآن]`;
          setMessages((m) =>
            m.map((mm) =>
              mm.id === botMsg.id ? { ...mm, content: msg, pending: false } : mm,
            ),
          );
          if (sid) await saveMessage(sid, 'assistant', msg);
          return;
        }

        throw new Error(parsed?.message || `Chat error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;
        fullText += chunk;
        setMessages((m) =>
          m.map((msg) =>
            msg.id === botMsg.id
              ? { ...msg, content: fullText, pending: false }
              : msg
          )
        );
      }
      if (fullText.includes('\n[ERROR]:')) {
        throw new Error(fullText.split('\n[ERROR]:').pop() || 'OpenAI error');
      }
      if (!fullText) {
        fullText = 'عذراً، لم أتمكن من الإجابة. حاول مرة ثانية.';
        setMessages((m) =>
          m.map((msg) =>
            msg.id === botMsg.id
              ? { ...msg, content: fullText, pending: false }
              : msg
          )
        );
      }
      if (sid) {
        const aiDbId = await saveMessage(sid, 'assistant', fullText);
        if (aiDbId) {
          setMessages((m) =>
            m.map((msg) =>
              msg.id === botMsg.id ? { ...msg, dbId: aiDbId } : msg,
            ),
          );
        }
      }
    } catch (err: unknown) {
      console.error(err);
      const raw = err instanceof Error ? err.message : '';
      // Map common error signatures onto user-friendly Arabic copy and a
      // recovery CTA. Each branch ends up as a single assistant bubble.
      let errMsg = 'عذراً، صار خطأ مع الخادم. حاول بعد شوية.\n\n[ACTION:retry|إعادة المحاولة]';
      if (/network|fetch|Failed to fetch|TypeError/i.test(raw)) {
        errMsg =
          'يبدو أن الاتصال بالإنترنت انقطع. تأكد من اتصالك وحاول مرة أخرى.\n\n[ACTION:retry|إعادة المحاولة]';
      } else if (/401|unauthor|no_session/i.test(raw)) {
        errMsg =
          'انتهت جلسة الدخول. سجّل دخول من جديد للمتابعة.\n\n[ACTION:/login|تسجيل الدخول]';
      } else if (/subscription|402|trial|اشتراك/i.test(raw)) {
        errMsg =
          'انتهت تجربتك المجانية. اشترك للاستمرار في استخدام الأستاذ ذكي.\n\n[ACTION:/account/subscription|اشترك الآن]';
      } else if (/rate.?limit|too many|429/i.test(raw)) {
        errMsg =
          'كثرة الطلبات في وقت قصير. انتظر دقيقة وحاول مرة أخرى.\n\n[ACTION:retry|إعادة المحاولة]';
      } else if (/openai|gpt|model/i.test(raw)) {
        errMsg =
          'الخادم الذكي مشغول حالياً. حاول مرة أخرى خلال لحظات.\n\n[ACTION:retry|إعادة المحاولة]';
      }
      setMessages((m) =>
        m.map((msg) =>
          msg.id === botMsg.id ? { ...msg, content: errMsg, pending: false } : msg,
        ),
      );
      if (sid) await saveMessage(sid, 'assistant', errMsg);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-dark-border">
        <div className="relative" ref={subjectPickerRef}>
          <button
            type="button"
            onClick={() => setSubjectPickerOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl border border-primary/60 bg-primary/10 px-3 py-1.5 text-sm font-medium hover:bg-primary/20 transition"
          >
            <BookOpen className="w-4 h-4" />
            {subject ? subject.name_ar : 'عام'}
            <ChevronDown className="w-4 h-4" />
          </button>
          {subjectPickerOpen && (
            <div className="absolute mt-2 w-56 z-30 card border border-dark-border rounded-xl shadow-xl py-1 max-h-80 overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  setSubjectPickerOpen(false);
                  // Navigate to general chat (clears fixed subject from URL)
                  router.push('/chat');
                  setSubjectId(null);
                  setMessages([]);
                  setSessionId(null);
                }}
                className="w-full text-right px-3 py-2 hover-surface text-sm"
              >
                عام
              </button>
              {DEFAULT_SUBJECTS.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => {
                    setSubjectPickerOpen(false);
                    // Navigate to subject chat — fresh session
                    router.push(`/chat/${s.id}`);
                    setSubjectId(s.id);
                    setMessages([]);
                    setSessionId(null);
                  }}
                  className="w-full text-right px-3 py-2 hover-surface text-sm flex items-center gap-2"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: s.color ?? '#1E66AA' }}
                  />
                  {s.name_ar}
                </button>
              ))}
            </div>
          )}
        </div>

        <Link
          href="/subjects"
          className="text-sm text-muted hover:text-primary-light"
        >
          كل المواد ←
        </Link>
      </div>

      {/* Messages / welcome */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 md:px-6 py-6"
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-start justify-start pt-6 md:pt-16">
            <div className="max-w-2xl w-full text-right">
              <h1 className="font-cairo font-extrabold text-4xl md:text-6xl leading-tight">
                {subject ? (
                  <>
                    <span className="gradient-text">أهلاً بك في</span>
                    <br />
                    <span className="gradient-text">{subject.name_ar}</span>
                    <br />
                    <span className="text-muted text-3xl md:text-5xl">
                      شنو حابب نتعلم اليوم؟
                    </span>
                  </>
                ) : (
                  <>
                    <span className="gradient-text">أهلاً،</span>
                    <br />
                    <span className="text-muted">
                      كيف يمكنني
                      <br />
                      مساعدتك اليوم؟
                    </span>
                  </>
                )}
              </h1>
              <p className="text-muted mt-6 text-lg">
                {subject
                  ? `اسألني أي سؤال من منهج ${subject.name_ar} أو دوس على اقتراح من اللي تحت`
                  : 'اختر مادة من الأعلى أو اسألني مباشرة أي سؤال من منهجك'}
              </p>

              <div className="grid md:grid-cols-2 gap-3 mt-8">
                {(subject ? SUBJECT_EXAMPLES[subject.id] ?? GENERAL_EXAMPLES : GENERAL_EXAMPLES).map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setInput(ex)}
                    className="text-right card border border-dark-border rounded-2xl px-4 py-3 hover:border-primary/60 transition"
                  >
                    <span className="text-sm text-muted">اقتراح</span>
                    <div className="text-sm md:text-base mt-0.5">{ex}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.map((m, idx) => {
              // Only the LAST assistant bubble can carry a retry action —
              // tapping it should remove that bubble + the user message
              // before it, then resend the last user question.
              const isLastAssistant =
                m.role === 'assistant' && idx === messages.length - 1;
              return (
                <ChatMessage
                  key={m.id}
                  role={m.role}
                  content={m.content}
                  streaming={m.pending}
                  messageId={m.dbId ?? null}
                  onRetry={
                    isLastAssistant
                      ? () => {
                          const lastUser = [...messages]
                            .reverse()
                            .find((mm) => mm.role === 'user');
                          if (!lastUser) return;
                          // Pop the failed assistant bubble + reuse the user text.
                          setMessages((prev) => prev.slice(0, prev.length - 1));
                          setInput(lastUser.content);
                          // Defer to next tick so input state lands before submit.
                          setTimeout(() => handleSend(), 0);
                        }
                      : undefined
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-dark-border p-3 md:p-4">
        <div className="max-w-3xl mx-auto card border border-dark-border rounded-2xl p-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="اسأل الأستاذ ذكي..."
            className="w-full resize-none bg-transparent outline-none px-3 py-2 font-tajawal text-[15px] leading-relaxed max-h-[200px]"
          />
          <div className="flex items-center justify-between px-1">
            <LiveVoiceLink />

            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              className="btn-primary !py-2 !px-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              إرسال
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * "الصوت الحي" entry point. On first click it opens an agreement modal
 * disclosing what happens during voice capture (mic recording, OpenAI
 * processing, no storage, daily 5-message cap, parental consent under 13).
 * Once the user accepts we set a flag in localStorage so they're not
 * asked again on subsequent visits.
 */
function LiveVoiceLink() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function go() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('live_voice_terms_accepted', '1');
    }
    setOpen(false);
    router.push('/voice');
  }

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    if (
      typeof window !== 'undefined' &&
      window.localStorage.getItem('live_voice_terms_accepted') === '1'
    ) {
      router.push('/voice');
      return;
    }
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary-light transition"
        title="محادثة صوتية"
      >
        <Mic className="w-4 h-4" />
        <span className="hidden md:inline">الصوت الحي</span>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="card border border-dark-border rounded-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <h3 className="text-lg font-extrabold mb-3">شروط استخدام الصوت الحي</h3>
            <ul className="text-sm text-muted space-y-2 leading-relaxed list-disc ps-5">
              <li>صوتك سيُرسَل إلى مزود الذكاء الاصطناعي (OpenAI) لتحويله إلى نص ثم إعادة تشغيله صوتياً.</li>
              <li>لا يتم تخزين تسجيلاتك على خوادمنا بعد انتهاء المحادثة.</li>
              <li>الميزة مخصصة للأسئلة التعليمية فقط، يُمنع استخدامها لأي محتوى مسيء.</li>
              <li>الحد اليومي 5 رسائل صوتية لكل طالب.</li>
              <li>إن كان عمرك أقل من 13 سنة فيجب الحصول على إذن ولي أمرك.</li>
            </ul>
            <div className="flex gap-2 mt-5 justify-end">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-xl text-sm text-muted hover:bg-surface transition"
              >
                رفض
              </button>
              <button
                onClick={go}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-l from-primary to-primary-light text-white"
              >
                أوافق وأكمل
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const GENERAL_EXAMPLES = [
  'اشرحلي نظرية فيثاغورس بطريقة سهلة',
  'شنو هي قوانين نيوتن الثلاثة؟',
  'اعطيني مراجعة سريعة عن التركيب الضوئي',
  'كيف أحفظ قصيدة باللغة العربية بسرعة؟',
];

const SUBJECT_EXAMPLES: Record<string, string[]> = {
  math: [
    'اشرحلي نظرية فيثاغورس بطريقة سهلة',
    'كيف أحل معادلة من الدرجة الثانية؟',
    'شنو الفرق بين النهاية والمشتقة؟',
    'اعطيني تمارين على الدوال المثلثية',
  ],
  physics: [
    'شنو هي قوانين نيوتن الثلاثة؟',
    'اشرحلي قانون أوم وكيف نطبقه',
    'شنو الفرق بين السرعة والتسارع؟',
    'كيف نحسب الطاقة الحركية؟',
  ],
  chemistry: [
    'اشرحلي الجدول الدوري بطريقة سهلة',
    'شنو هو التفاعل المتعادل؟',
    'كيف نحسب الكتلة المولية؟',
    'شنو الفرق بين الأحماض والقواعد؟',
  ],
  biology: [
    'اعطيني مراجعة سريعة عن التركيب الضوئي',
    'اشرحلي تركيب الخلية وأجزاءها',
    'شنو هي مراحل الانقسام الخلوي؟',
    'كيف يعمل الجهاز الدوري في الإنسان؟',
  ],
  english: [
    'What is the difference between past simple and past continuous?',
    'اشرحلي قواعد present perfect',
    'Give me a list of common irregular verbs',
    'كيف أحفظ كلمات إنجليزية بسرعة؟',
  ],
  arabic: [
    'كيف أحفظ قصيدة باللغة العربية بسرعة؟',
    'اشرحلي إعراب الجملة الاسمية',
    'شنو الفرق بين الفعل اللازم والمتعدي؟',
    'اعطيني ملخص عن البلاغة العربية',
  ],
  islamic: [
    'اشرحلي أحكام التجويد',
    'شنو هي أركان الإسلام الخمسة؟',
    'اعطيني سيرة مختصرة عن الخلفاء الراشدين',
    'كيف أحفظ سورة من القرآن بسرعة؟',
  ],
  history: [
    'اعطيني ملخص عن الحضارة العباسية',
    'شنو أهم أحداث الحرب العالمية الأولى؟',
    'اشرحلي تاريخ تأسيس العراق الحديث',
    'مين هو صلاح الدين الأيوبي؟',
  ],
  geography: [
    'اشرحلي الفرق بين المناخ والطقس',
    'شنو أهم تضاريس العراق؟',
    'كيف تتكون الأنهار والبحيرات؟',
    'اعطيني نظرة عامة عن قارة آسيا',
  ],
  economics: [
    'شنو الفرق بين العرض والطلب؟',
    'اشرحلي مفهوم التضخم بطريقة سهلة',
    'شنو أنواع الأسواق الاقتصادية؟',
    'كيف يعمل النظام المصرفي؟',
  ],
};
