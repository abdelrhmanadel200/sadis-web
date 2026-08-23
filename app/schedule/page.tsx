'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/providers/AuthProvider';

interface Cell {
  id?: string;
  subject: string;
  note: string;
}

/** الأسبوع الدراسي العراقي: السبت .. الخميس (الجمعة عطلة). */
const DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

const key = (d: number, p: number) => `${d}-${p}`;

export default function SchedulePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [loading, setLoading] = useState(true);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  // مؤقتات الحفظ التلقائي لكل خانة على حدة.
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('weekly_schedule')
      .select('id, day_of_week, period_no, subject, note')
      .eq('user_id', user.id);
    const map: Record<string, Cell> = {};
    for (const r of data ?? []) {
      const row = r as { id: string; day_of_week: number; period_no: number; subject: string | null; note: string | null };
      map[key(row.day_of_week, row.period_no)] = {
        id: row.id,
        subject: row.subject ?? '',
        note: row.note ?? '',
      };
    }
    setCells(map);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  /** حفظ تلقائي بعد التوقف عن الكتابة — الجدول يبقى محفوظاً دائماً. */
  const update = (d: number, p: number, patch: Partial<Cell>) => {
    const k = key(d, p);
    setCells((prev) => {
      const base: Cell = prev[k] ?? { subject: '', note: '' };
      const next = { ...prev, [k]: { ...base, ...patch } };
      return next;
    });
    clearTimeout(timers.current[k]);
    timers.current[k] = setTimeout(async () => {
      if (!user) return;
      const base: Cell = cells[k] ?? { subject: '', note: '' };
      const cur: Cell = { ...base, ...patch };
      const empty = !cur.subject.trim() && !cur.note.trim();
      if (empty) {
        // خانة فُرّغت بالكامل → احذف الصف بدل تخزين فراغ.
        await supabase
          .from('weekly_schedule')
          .delete()
          .eq('user_id', user.id)
          .eq('day_of_week', d)
          .eq('period_no', p);
      } else {
        await supabase.from('weekly_schedule').upsert(
          {
            user_id: user.id,
            day_of_week: d,
            period_no: p,
            subject: cur.subject.trim() || null,
            note: cur.note.trim() || null,
          },
          { onConflict: 'user_id,day_of_week,period_no' },
        );
      }
      setSavedAt(new Date().toLocaleTimeString('ar-IQ'));
    }, 700);
  };

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
          <h1 className="text-3xl md:text-4xl font-bold mb-2">جدول الحصص الأسبوعي</h1>
          <p className="text-muted">
            اكتب مادة كل حصة وملاحظاتك — يُحفظ تلقائياً ويبقى محفوظاً في حسابك.
          </p>
        </header>

        {/* فرعا القسم */}
        <div className="flex flex-wrap gap-2 mb-5 border-b border-dark-border pb-3">
          <Link
            href="/calendar"
            className="px-4 py-2 rounded-xl text-sm font-bold bg-card/40 text-muted hover:text-foreground transition"
          >
            تقويم وعطل
          </Link>
          <span className="px-4 py-2 rounded-xl text-sm font-bold bg-primary text-white">
            الجدول الأسبوعي
          </span>
          {savedAt && (
            <span className="ms-auto inline-flex items-center gap-1.5 text-xs text-emerald-500 self-center">
              <Check className="w-3.5 h-3.5" /> تم الحفظ {savedAt}
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-10 text-center text-muted flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> جاري التحميل...
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full border-separate border-spacing-1 min-w-[720px]">
              <thead>
                <tr>
                  <th className="w-16 text-xs text-muted font-semibold pb-2">الحصة</th>
                  {DAYS.map((d) => (
                    <th key={d} className="text-sm font-bold pb-2 text-foreground">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((p) => (
                  <tr key={p}>
                    <td className="text-center text-sm font-bold text-primary-light">{p}</td>
                    {DAYS.map((_, d) => {
                      const c = cells[key(d, p)] ?? { subject: '', note: '' };
                      return (
                        <td key={d} className="align-top">
                          <div className={`rounded-xl border p-1.5 transition focus-within:border-primary ${
                              c.subject.trim()
                                ? 'border-primary/40 bg-primary/10'
                                : 'border-dark-border bg-card/60'
                            }`}>
                            <input
                              value={c.subject}
                              onChange={(e) => update(d, p, { subject: e.target.value })}
                              placeholder="المادة"
                              className="w-full bg-transparent text-sm font-semibold text-center text-foreground outline-none placeholder:text-muted"
                            />
                            <input
                              value={c.note}
                              onChange={(e) => update(d, p, { note: e.target.value })}
                              placeholder="ملاحظة"
                              className="w-full bg-transparent text-[11px] text-center text-muted outline-none placeholder:text-muted/70 mt-0.5"
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
