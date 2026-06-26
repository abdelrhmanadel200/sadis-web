import { createClient } from '@supabase/supabase-js';

/**
 * Server-side RAG helper.
 * 1) Embed the question via OpenAI text-embedding-3-small (1536 dims).
 * 2) Call the Supabase `match_curriculum` RPC with subject filter.
 * 3) Return up to N chunks of matching curriculum content.
 */

const OPENAI_KEY = process.env.OPENAI_API_KEY ?? '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

// Use service role for the RPC because curriculum_chunks RLS only allows
// authenticated users — server-side we bypass with the service key.
const adminClient =
  SUPABASE_URL && SUPABASE_SERVICE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

async function embedQuestion(text: string): Promise<number[] | null> {
  if (!OPENAI_KEY || !text.trim()) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.data?.[0]?.embedding as number[]) ?? null;
  } catch {
    return null;
  }
}

export interface RagOptions {
  question: string;
  subjectId?: string | null;
  matchCount?: number;
  matchThreshold?: number;
}

export interface RagChunk {
  content: string;
  source_file: string;
  chapter?: string | null;
  page?: number | null;
  similarity?: number;
}

/**
 * Look up the most relevant curriculum chunks for a question.
 * Returns an empty array if RAG is unavailable (no chunks, no embedding,
 * or RPC missing) — callers must handle that gracefully.
 */
export async function fetchRagContext(opts: RagOptions): Promise<RagChunk[]> {
  if (!adminClient) return [];
  if (!opts.subjectId || opts.subjectId === 'general') {
    // No subject = no scoped lookup. Could broaden later if needed.
    return [];
  }

  const embedding = await embedQuestion(opts.question);
  if (!embedding) return [];

  try {
    const { data, error } = await adminClient.rpc('match_curriculum', {
      query_embedding: embedding,
      subject_filter: opts.subjectId,
      match_count: opts.matchCount ?? 5,
      match_threshold: opts.matchThreshold ?? 0.55,
    });
    if (error || !data) return [];
    return data as RagChunk[];
  } catch {
    return [];
  }
}

/** Build a concise context string from matched chunks for prompt injection. */
export function buildRagContext(chunks: RagChunk[]): string {
  if (!chunks.length) return '';
  return chunks
    .map((c, i) => {
      const head = `[مقتطف ${i + 1}${c.page ? ` — صفحة ${c.page}` : ''}]`;
      return `${head}\n${c.content}`;
    })
    .join('\n\n---\n\n');
}
