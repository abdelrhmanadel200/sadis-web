'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabase';
import { DEFAULT_SUBJECTS } from '@/lib/subjects';
import type { Subject } from '@/lib/types';
import {
  Calculator,
  Zap,
  FlaskConical,
  Dna,
  Languages,
  Scroll,
  Moon,
  Landmark,
  Globe,
  BarChart3,
  BookOpen,
} from 'lucide-react';

const ICONS: Record<string, React.ReactNode> = {
  calculator: <Calculator className="w-8 h-8" />,
  zap: <Zap className="w-8 h-8" />,
  flask: <FlaskConical className="w-8 h-8" />,
  dna: <Dna className="w-8 h-8" />,
  languages: <Languages className="w-8 h-8" />,
  scroll: <Scroll className="w-8 h-8" />,
  moon: <Moon className="w-8 h-8" />,
  landmark: <Landmark className="w-8 h-8" />,
  globe: <Globe className="w-8 h-8" />,
  'bar-chart': <BarChart3 className="w-8 h-8" />,
};

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>(DEFAULT_SUBJECTS);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .order('sort_order', { ascending: true });
      if (!error && data && data.length) setSubjects(data as Subject[]);
    })();
  }, []);

  return (
    <AppShell>
      <div className="p-5 md:p-8 max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="font-cairo font-extrabold text-3xl md:text-4xl mb-2">
            المواد الدراسية
          </h1>
          <p className="text-muted">اختر المادة وابدأ محادثة مع الأستاذ ذكي</p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {subjects.map((s) => (
            <Link
              key={s.id}
              href={`/chat/${s.id}`}
              className="card border border-dark-border rounded-2xl p-5 hover:border-primary/60 hover:-translate-y-1 transition-all flex flex-col items-start gap-3"
              style={{
                boxShadow: `0 0 0 1px transparent`,
              }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-white"
                style={{
                  background: `linear-gradient(135deg, ${s.color ?? '#1E66AA'} 0%, ${s.color ?? '#1E66AA'}AA 100%)`,
                }}
              >
                {ICONS[s.icon ?? ''] ?? <BookOpen className="w-8 h-8" />}
              </div>
              <div>
                <h3 className="font-cairo font-bold text-lg">{s.name_ar}</h3>
                {s.name_en && (
                  <p className="font-mulish text-xs text-muted">{s.name_en}</p>
                )}
              </div>
              <span className="mt-auto text-sm text-primary-light">
                ابدأ المحادثة ←
              </span>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
