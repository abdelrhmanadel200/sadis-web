'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, ChevronRight, ChevronLeft, GraduationCap } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Ev {
  id: string;
  title: string;
  event_type: string;
  day_kind: string | null;
  event_date: string;
  end_date: string | null;
  description: string | null;
}

const MONTHS = [
  'كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران',
  'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول',
];
const WEEKDAYS = ['سبت', 'أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة'];

const KIND_STYLE: Record<string, string> = {
  official: 'bg-red-500/25 text-red-400 border-red-500/50',
  unofficial: 'bg-amber-500/25 text-amber-400 border-amber-500/50',
};

function ymd(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function CalendarPage() {
  const [rows, setRows] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

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

  const holidayByDate = useMemo(() => {
    const m = new Map<string, Ev>();
    for (const r of rows) {
      if (r.event_type === 'holiday' || r.day_kind) m.set(r.event_date, r);
    }
    return m;
  }, [rows]);

  const exams = rows.filter((r) => r.event_type === 'exam');

  return (
    <main className="min-h-screen bg-background text-foreground" dir="rtl">
      <div className="max-w-6xl mx-auto px-5 py-10">
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 text-sm text-muted hover:opacity-80 mb-6"
        >
          <ArrowRight className="w-4 h-4" />
          العودة
        </Link>

        <header className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">تقويم السادس</h1>
          <p className="text-muted">العطل الرسمية وغير المعلنة ومواعيد الامتحانات.</p>
        </header>

        {/* فرعا القسم */}
        <div className="flex flex-wrap gap-2 mb-5 border-b border-dark-border pb-3">
          <span className="px-4 py-2 rounded-xl text-sm font-bold bg-primary text-white">
            تقويم وعطل
          </span>
          <Link
            href="/schedule"
            className="px-4 py-2 rounded-xl text-sm font-bold bg-card/40 text-muted hover:text-foreground transition"
          >
            الجدول الأسبوعي
          </Link>
        </div>

        {/* شريط السنة + مفتاح الألوان */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setYear((y) => y - 1)}
              className="p-2 rounded-lg border border-dark-border hover:border-primary/40"
              aria-label="السنة السابقة"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="text-xl font-bold w-20 text-center">{year}</span>
            <button
              onClick={() => setYear((y) => y + 1)}
              className="p-2 rounded-lg border border-dark-border hover:border-primary/40"
              aria-label="السنة التالية"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-red-500/70" /> عطلة رسمية
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-500/70" /> عطلة غير معلنة
            </span>
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-muted flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> جاري التحميل...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {MONTHS.map((name, mi) => (
              <MonthCard
                key={mi}
                name={name}
                year={year}
                monthIndex={mi}
                holidayByDate={holidayByDate}
              />
            ))}
          </div>
        )}

        {exams.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xl font-bold mb-3">مواعيد الامتحانات</h2>
            <div className="space-y-2">
              {exams.map((e) => (
                <div
                  key={e.id}
                  className="card border border-dark-border rounded-2xl p-4 flex items-start gap-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                    <GraduationCap className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-bold">{e.title}</h3>
                    <p className="text-sm text-muted mt-0.5" dir="ltr">
                      {e.event_date}
                      {e.end_date ? ` — ${e.end_date}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function MonthCard({
  name,
  year,
  monthIndex,
  holidayByDate,
}: {
  name: string;
  year: number;
  monthIndex: number;
  holidayByDate: Map<string, Ev>;
}) {
  const first = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const lead = (first.getDay() + 1) % 7; // نبدأ الأسبوع بالسبت
  const today = new Date();
  const isToday = (d: number) =>
    today.getFullYear() === year && today.getMonth() === monthIndex && today.getDate() === d;

  return (
    <div className="card border border-dark-border rounded-2xl p-4">
      <h3 className="font-bold text-center mb-3">{name}</h3>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-[10px] text-muted pb-1">
            {d}
          </div>
        ))}
        {Array.from({ length: lead }).map((_, i) => (
          <div key={`b${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const ev = holidayByDate.get(ymd(year, monthIndex, day));
          const style = ev ? KIND_STYLE[ev.day_kind ?? 'official'] : '';
          return (
            <div
              key={day}
              title={ev?.title}
              className={`aspect-square rounded-md text-xs font-semibold border flex items-center justify-center ${
                ev
                  ? style
                  : isToday(day)
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted'
              }`}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}
