'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, Newspaper, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface News {
  id: string;
  title: string;
  body: string | null;
  url: string | null;
  source: string | null;
  image_url: string | null;
  published_at: string | null;
}

function formatDate(d: string | null): string {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('ar-IQ', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function NewsPage() {
  const [rows, setRows] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('news_posts')
        .select('*')
        .order('published_at', { ascending: false });
      if (cancelled) return;
      setRows((data ?? []) as News[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground" dir="rtl">
      <div className="max-w-3xl mx-auto px-5 py-10">
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 text-sm text-muted hover:opacity-80 mb-6"
        >
          <ArrowRight className="w-4 h-4" />
          العودة
        </Link>

        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">أخبار السادس</h1>
          <p className="text-muted">قرارات الوزارة والأخبار المهمة لطلاب السادس.</p>
        </header>

        {loading ? (
          <div className="py-10 text-center text-muted flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> جاري التحميل...
          </div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-muted">لا توجد أخبار بعد.</div>
        ) : (
          <div className="space-y-4">
            {rows.map((n) => (
              <article
                key={n.id}
                className="card border border-dark-border rounded-2xl p-5"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <Newspaper className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-xs text-muted">
                    {n.source && <span className="font-semibold">{n.source}</span>}
                    {n.source && n.published_at && ' · '}
                    {formatDate(n.published_at)}
                  </div>
                </div>
                <h3 className="font-bold text-lg mb-1">{n.title}</h3>
                {n.body && (
                  <p className="text-sm text-muted leading-relaxed whitespace-pre-line">
                    {n.body}
                  </p>
                )}
                {n.url && (
                  <a
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-3"
                  >
                    المصدر <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
