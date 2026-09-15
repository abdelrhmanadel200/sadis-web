'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Search, FileText, Loader2, User as UserIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/providers/AuthProvider';
import { ReportButton } from '@/components/ReportButton';
import LibraryShareForm from '@/components/LibraryShareForm';
import { useReactions, ReactionBar, OfficialBadge } from '@/components/reactions';

export type LibrarySectionId = 'community' | 'ministry';

interface PublicFile {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  subject_id: string | null;
  storage_path: string | null;
  external_url: string | null;
  file_size_bytes: number | null;
  cover_url: string | null;
  is_official: boolean;
  uploaded_at: string;
  uploader_name?: string | null;
}

const SUBJECT_LABEL: Record<string, string> = {
  math: 'الرياضيات (علمي)',
  math_lit: 'الرياضيات (أدبي)',
  physics: 'الفيزياء',
  chemistry: 'الكيمياء',
  biology: 'الأحياء',
  arabic: 'العربي',
  english: 'الإنجليزي',
  islamic: 'الإسلامية',
  history: 'التاريخ',
  geography: 'الجغرافيا',
  economics: 'الاقتصاد',
};

/**
 * قسم مكتبة مشتركة يرفع فيه الأعضاء والإدارة: مكتبة سادس، ومناهج الأسئلة
 * الوزارية. نفس النظام (رفع بغلاف إجباري، موافقة الإدارة، إبلاغ، تفاعل)
 * مع اختلاف القسم فقط.
 */
export default function LibrarySection({
  section,
  title,
  description,
  icon,
}: {
  section: LibrarySectionId;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [files, setFiles] = useState<PublicFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('all');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('user_library_files')
      .select('id, user_id, title, author, subject_id, storage_path, external_url, file_size_bytes, cover_url, is_official, uploaded_at')
      .eq('is_public', true)
      .eq('approved', true)
      .eq('removed', false)
      .eq('section', section)
      .order('is_official', { ascending: false })
      .order('uploaded_at', { ascending: false })
      .limit(300);
    const rows = (data ?? []) as PublicFile[];

    const ids = Array.from(new Set(rows.filter((r) => !r.is_official).map((r) => r.user_id)));
    if (ids.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', ids);
      const names = new Map<string, string>((profiles ?? []).map((p) => [p.id, (p.name as string) || '']));
      for (const r of rows) r.uploader_name = names.get(r.user_id) || null;
    }
    setFiles(rows);
    setLoading(false);
  }, [section]);

  useEffect(() => {
    void load();
  }, [load]);

  const { counts: rx, toggle: toggleRx } = useReactions('library_file', files.map((f) => f.id));

  // الضغط على الغلاف يفتح الملف مباشرة. نفتح النافذة فوراً ثم نوجّهها بعد
  // تجهيز الرابط الموقّع، حتى لا يحجبها متصفح الموبايل كنافذة منبثقة.
  const openFile = async (f: PublicFile) => {
    if (f.external_url) {
      if (!/^https?:\/\//i.test(f.external_url)) {
        alert('رابط غير مسموح');
        return;
      }
      window.open(f.external_url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!f.storage_path) return;
    const win = window.open('', '_blank');
    const { data, error } = await supabase.storage
      .from('user-library')
      .createSignedUrl(f.storage_path, 60 * 30);
    if (error || !data?.signedUrl) {
      win?.close();
      alert('تعذّر فتح الملف');
      return;
    }
    if (win) {
      win.opener = null;
      win.location.href = data.signedUrl;
    } else {
      window.location.href = data.signedUrl;
    }
  };

  const subjects = useMemo(
    () => Array.from(new Set(files.map((f) => f.subject_id).filter((s): s is string => !!s))),
    [files],
  );

  const visible = files.filter((f) => {
    if (subject !== 'all' && f.subject_id !== subject) return false;
    if (!search) return true;
    const hay = `${f.title} ${f.author ?? ''} ${f.uploader_name ?? ''}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </main>
    );
  }
  if (!user) return null;

  return (
    <main className="min-h-screen bg-background text-foreground" dir="rtl">
      <div className="max-w-6xl mx-auto px-5 py-10">
        <Link href="/chat" className="inline-flex items-center gap-2 text-sm text-muted hover:opacity-80 mb-6">
          <ArrowRight className="w-4 h-4" />
          العودة
        </Link>

        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 flex items-center gap-2">
            {icon}
            {title}
          </h1>
          <p className="text-muted">{description}</p>
        </header>

        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-500 flex flex-wrap items-center gap-1">
          <span>
            الملفات التي يرفعها الأعضاء مسؤولية أصحابها، والموقع غير مسؤول عن محتواها. الملفات
            التي تحمل علامة الصح الزرقاء رفعها فريق سادس ألترا.
          </span>
          <Link href="/copyright" className="font-bold underline hover:opacity-80">
            سياسة حقوق الطبع والنشر
          </Link>
        </div>

        <LibraryShareForm user={user} section={section} sectionLabel={title} onShared={() => void load()} />

        <div className="mb-4 relative max-w-md">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالعنوان أو الأستاذ..."
            className="w-full rounded-xl bg-card/40 border border-dark-border ps-9 pe-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </div>

        {subjects.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {['all', ...subjects].map((s) => (
              <button
                key={s}
                onClick={() => setSubject(s)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition ${
                  subject === s ? 'bg-primary text-white border-primary' : 'border-dark-border text-muted hover:border-primary'
                }`}
              >
                {s === 'all' ? 'الكل' : SUBJECT_LABEL[s] ?? s}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="text-muted text-center py-10 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> جاري التحميل...
          </div>
        ) : visible.length === 0 ? (
          <div className="card border border-dark-border rounded-2xl p-12 text-center text-muted">
            لا توجد ملفات هنا بعد. شارك أول ملف من النموذج أعلاه.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {visible.map((f) => (
              <div key={f.id} className="card border border-dark-border rounded-2xl overflow-hidden flex flex-col">
                <button
                  onClick={() => openFile(f)}
                  className="relative aspect-[3/4] bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center"
                  title="اضغط لفتح الملف"
                >
                  {f.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.cover_url} alt={f.title} className="w-full h-full object-cover" />
                  ) : (
                    <FileText className="w-12 h-12 text-primary-light/70" />
                  )}
                  {f.is_official && <OfficialBadge className="absolute top-2 end-2" />}
                </button>
                <div className="p-3 flex-1 flex flex-col gap-1">
                  <button onClick={() => openFile(f)} className="text-start font-bold text-sm line-clamp-2 hover:text-primary-light">
                    {f.title}
                  </button>
                  {f.author && <p className="text-xs text-muted line-clamp-1">{f.author}</p>}
                  <p className="text-xs text-muted flex items-center gap-1">
                    <UserIcon className="w-3 h-3" />
                    {f.is_official ? 'فريق سادس ألترا' : f.uploader_name || 'عضو'}
                  </p>
                  <div className="mt-auto pt-2 flex items-center justify-between gap-1">
                    <ReactionBar itemId={f.id} counts={rx[f.id]} onToggle={toggleRx} compact />
                    {!f.is_official && <ReportButton kind="library_file" itemId={f.id} />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
