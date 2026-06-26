'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, ArrowLeft, ThumbsUp, ThumbsDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { supabase } from '@/lib/supabase';

interface Props {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  /** Called when the user taps an inline "إعادة المحاولة" action. */
  onRetry?: () => void;
  /**
   * Supabase `chat_messages.id`. When present (and the message is from the
   * assistant), the bubble renders 👍/👎 buttons that write to ai_feedback.
   */
  messageId?: string | null;
}

function extractAction(content: string):
  | { body: string; action: { href: string; label: string } }
  | { body: string; action: null } {
  const m = content.match(/\n*\[ACTION:([^|\]]+)\|([^\]]+)\]\s*$/);
  if (!m) return { body: content, action: null };
  return {
    body: content.slice(0, m.index).trimEnd(),
    action: { href: m[1].trim(), label: m[2].trim() },
  };
}

export default function ChatMessage({
  role,
  content,
  streaming,
  onRetry,
  messageId,
}: Props) {
  const isUser = role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-start animate-fade-in">
        <div className="max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3 bg-primary/15 border border-primary/30 rounded-tr-sm">
          <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
        </div>
      </div>
    );
  }

  const { body, action } = extractAction(content);

  return (
    <div className="animate-fade-in py-1">
      <div className="text-xs font-bold mb-2" style={{ color: '#1EA0D1' }}>
        الأستاذ ذكي
      </div>
      {body ? (
        <div className="prose-chat text-current">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[
              [
                rehypeKatex,
                { throwOnError: false, strict: 'ignore', output: 'html' },
              ],
            ]}
          >
            {body}
          </ReactMarkdown>
        </div>
      ) : streaming ? (
        // Loading text + animated dots — replaces the bare spinner.
        <SearchingForAnswer />
      ) : null}

      {action && (
        <div className="mt-3">
          {action.href === 'retry' ? (
            <button
              onClick={() => onRetry?.()}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-l from-primary to-primary-light text-white font-bold px-5 py-2.5 text-sm shadow-lg shadow-primary/30 hover:opacity-90 transition"
            >
              <RefreshCw className="w-4 h-4" />
              {action.label}
            </button>
          ) : action.href.startsWith('/') ? (
            <Link
              href={action.href}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-l from-primary to-primary-light text-white font-bold px-5 py-2.5 text-sm shadow-lg shadow-primary/30 hover:opacity-90 transition"
            >
              {action.label}
              <ArrowLeft className="w-4 h-4" />
            </Link>
          ) : (
            <a
              href={action.href}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-l from-primary to-primary-light text-white font-bold px-5 py-2.5 text-sm shadow-lg shadow-primary/30 hover:opacity-90 transition"
            >
              {action.label}
              <ArrowLeft className="w-4 h-4" />
            </a>
          )}
        </div>
      )}

      {/* Feedback only once the assistant message has a DB id (so we can
          attach the vote to a specific row). Streaming bubbles don't show
          buttons yet — they appear when the row is persisted. */}
      {messageId && body && <FeedbackButtons messageId={messageId} />}
    </div>
  );
}

function SearchingForAnswer() {
  return (
    <div className="flex items-center gap-2 py-1 text-sm text-muted">
      <span>جاري البحث عن الإجابة</span>
      <span className="flex gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-primary-light animate-pulse" />
        <span className="w-1.5 h-1.5 rounded-full bg-primary-light animate-pulse [animation-delay:0.15s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-primary-light animate-pulse [animation-delay:0.3s]" />
      </span>
    </div>
  );
}

function FeedbackButtons({ messageId }: { messageId: string }) {
  // Local mirror of the user's vote. 0 = no vote, 1 = thumbs up, -1 = down.
  const [vote, setVote] = useState<0 | 1 | -1>(0);
  const [busy, setBusy] = useState(false);

  // Hydrate the current user's existing vote on mount so the colored thumb
  // survives a page reload / chat history restore.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) return;
        const { data } = await supabase
          .from('ai_feedback')
          .select('rating')
          .eq('message_id', messageId)
          .eq('user_id', userId)
          .maybeSingle();
        if (!cancelled && data?.rating) {
          setVote(data.rating === 1 ? 1 : -1);
        }
      } catch {/* ignore */}
    })();
    return () => {
      cancelled = true;
    };
  }, [messageId]);

  async function submit(rating: 1 | -1) {
    if (busy) return;
    const wasActive = vote === rating;
    const optimistic = wasActive ? 0 : rating;
    setVote(optimistic);
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return;
      if (wasActive) {
        await supabase
          .from('ai_feedback')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', userId);
      } else {
        await supabase.from('ai_feedback').upsert({
          message_id: messageId,
          user_id: userId,
          rating,
        });
      }
    } catch {
      // Revert on failure so the UI stays honest.
      setVote(wasActive ? rating : 0);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 flex items-center gap-1 text-muted">
      <button
        onClick={() => submit(1)}
        className={`p-1.5 rounded-md transition ${
          vote === 1 ? 'text-primary-light' : 'hover:text-primary-light'
        }`}
        aria-label="مفيد"
      >
        <ThumbsUp className="w-4 h-4" fill={vote === 1 ? 'currentColor' : 'none'} />
      </button>
      <button
        onClick={() => submit(-1)}
        className={`p-1.5 rounded-md transition ${
          vote === -1 ? 'text-error' : 'hover:text-error'
        }`}
        aria-label="غير مفيد"
      >
        <ThumbsDown className="w-4 h-4" fill={vote === -1 ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}
