'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, CalendarDays, Umbrella, GraduationCap } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Ev {
  id: string;
  title: string;
  event_type: string;
  event_date: string;
  end_date: string | null;
  description: string | null;
}

const TYPE_META: Record<
  string,
  { label: string; classes: string; icon: typeof CalendarDays }
> = {
  school_day: {
    label: 'دوام',
    classes: 'bg-primary/15 text-primary border-primary/30',
    icon: CalendarDays,
  },
  holiday: {
    label: 'عطلة رسمية',
    classes: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
    icon: Umbrella,
  },
  exam: {
    label: 'امتحان',
    classes: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
    icon: GraduationCap,
  },
};

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString('ar-IQ', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return d;
  }
}

export default function CalendarPage() {
  const [rows, setRows] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('calendar_events')
        .select('*')
        .order('event_date', { ascending: true });
      if (cancelled) return;
      setRows((data ?? []) as Ev[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = filter === 'all' ? rows : rows.filter((r) => r.event_type === filter);

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
          <h1 className="text-3xl md:text-4xl font-bold mb-2">تقويم السادس</h1>
          <p className="text-muted">أيام الدوام والعطل الرسمية ومواعيد الامتحانات.</p>
        </header>

        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { id: 'all', label: 'الكل' },
            { id: 'exam', label: 'الامتحانات' },
            { id: 'holiday', label: 'العطل' },
            { id: 'school_day', label: 'الدوام' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
                filter === f.id
                  ? 'bg-primary text-white border-primary'
                  : 'border-dark-border text-muted hover:border-primary/40'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-10 text-center text-muted flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> جاري التحميل...
          </div>
        ) : visible.length === 0 ? (
          <div className="py-10 text-center text-muted">لا توجد مواعيد في هذا القسم.</div>
        ) : (
          <div className="space-y-3">
            {visible.map((e) => {
              const meta = TYPE_META[e.event_type] ?? TYPE_META.school_day;
              const Icon = meta.icon;
              return (
                <div
                  key={e.id}
                  className="card border border-dark-border rounded-2xl p-4 flex items-start gap-3"
                >
                  <div
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${meta.classes}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold">{e.title}</h3>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${meta.classes}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-sm text-muted mt-1">
                      {formatDate(e.event_date)}
                      {e.end_date ? ` — ${formatDate(e.end_date)}` : ''}
                    </p>
                    {e.description && (
                      <p className="text-sm text-muted mt-1">{e.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
