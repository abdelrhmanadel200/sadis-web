'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/providers/AuthProvider';
import WorkbookEditor, { type WorkbookRow } from '@/components/workbooks/WorkbookEditor';

export default function WorkbookPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [workbook, setWorkbook] = useState<WorkbookRow | null>(null);
  const [profile, setProfile] = useState<{ name: string; email: string }>({ name: '', email: '' });
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?next=' + encodeURIComponent(`/workbooks/${id ?? ''}`));
    }
  }, [authLoading, user, router, id]);

  const load = useCallback(async () => {
    if (!user || !id) return;
    setLoading(true);
    // سياسة RLS تضمن أن الطالب لا يرى إلا دفاتره هو.
    const [{ data: wb }, { data: prof }] = await Promise.all([
      supabase
        .from('workbooks')
        .select('id, user_id, subject, title, kind, content')
        .eq('id', id)
        .maybeSingle(),
      supabase.from('profiles').select('name, email').eq('id', user.id).maybeSingle(),
    ]);
    if (!wb) {
      setMissing(true);
      setLoading(false);
      return;
    }
    setWorkbook(wb as WorkbookRow);
    setProfile({
      name: (prof?.name as string) || 'طالب سادس ألترا',
      email: (prof?.email as string) || user.email || '',
    });
    setLoading(false);
  }, [user, id]);

  useEffect(() => { void load(); }, [load]);

  if (authLoading || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </main>
    );
  }
  if (!user) return null;

  if (missing || !workbook) {
    return (
      <main className="min-h-screen bg-background text-foreground" dir="rtl">
        <div className="max-w-3xl mx-auto px-5 py-16 text-center">
          <p className="text-muted mb-5">هذا الدفتر غير موجود أو لم يعد متاحاً.</p>
          <Link
            href="/workbooks"
            className="inline-flex items-center gap-2 rounded-xl bg-primary text-white font-bold px-5 py-2.5 text-sm hover:opacity-90"
          >
            <ArrowRight className="w-4 h-4" />
            العودة لحقيبة الدفاتر
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground" dir="rtl">
      <div className="max-w-4xl mx-auto px-5 py-8">
        <WorkbookEditor
          workbook={workbook}
          studentName={profile.name}
          studentEmail={profile.email}
        />
      </div>
    </main>
  );
}
