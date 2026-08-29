'use client';

import PlatformGate from '@/components/PlatformGate';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Search,
  Download,
  FileText,
  Library as LibraryIcon,
  User as UserIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/providers/AuthProvider';
import { ReportButton } from '@/components/ReportButton';

interface PublicFile {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  storage_path: string | null;
  external_url: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  uploaded_at: string;
  uploader_name?: string | null;
}

/**
 * Public "browse the library" page — every member can see files everyone has
 * uploaded. The owner's name shows under each file, and there's a Report
 * button so copyright issues can be flagged fast.
 */
function LibraryBrowsePageInner() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [files, setFiles] = useState<PublicFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('user_library_files')
      .select('id, user_id, title, description, storage_path, external_url, file_size_bytes, mime_type, uploaded_at')
      .eq('is_public', true)
      .eq('approved', true)
      .eq('removed', false)
      .order('uploaded_at', { ascending: false })
      .limit(200);
    const rows = (data ?? []) as PublicFile[];

    // Best-effort: pull uploader names so each file shows who shared it.
    const uniqueUserIds = Array.from(new Set(rows.map((r) => r.user_id)));
    if (uniqueUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', uniqueUserIds);
      const nameMap = new Map<string, string>(
        (profiles ?? []).map((p) => [p.id, (p.name as string) || '']),
      );
      for (const r of rows) {
        r.uploader_name = nameMap.get(r.user_id) || null;
      }
    }
    setFiles(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDownload = async (f: PublicFile) => {
    // Link entries open directly.
    if (f.external_url) {
      // حماية: نرفض أي بروتوكول غير http/https (روابط قد يُدخلها أعضاء).
      if (!/^https?:\/\//i.test(f.external_url)) {
        alert('رابط غير مسموح');
        return;
      }
      window.open(f.external_url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!f.storage_path) return;
    const { data, error } = await supabase.storage
      .from('user-library')
      .createSignedUrl(f.storage_path, 60 * 30);
    if (error || !data?.signedUrl) {
      alert('تعذّر فتح الملف');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const visible = files.filter((f) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const hay = `${f.title} ${f.uploader_name ?? ''} ${f.description ?? ''}`.toLowerCase();
    return hay.includes(q);
  });

  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-muted">جاري التحميل...</div>
      </main>
    );
  }
  if (!user) return null;

  return (
    <main className="min-h-screen bg-background text-foreground" dir="rtl">
      <div className="max-w-6xl mx-auto px-5 py-10">
        <Link
          href="/library"
          className="inline-flex items-center gap-2 text-sm text-muted hover:opacity-80 mb-6"
        >
          <ArrowRight className="w-4 h-4" />
          العودة لمكتبتي
        </Link>

        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 flex items-center gap-2">
            <LibraryIcon className="w-7 h-7 text-primary-light" />
            مكتبة سادس
          </h1>
          <p className="text-muted">
            ملفات وملاحظات شاركها أعضاء المنصة. اضغط على علامة الإبلاغ للتبليغ عن أي محتوى ينتهك حقوق النشر.
          </p>
        </header>

        <div className="mb-6 relative max-w-md">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث في الملفات..."
            className="w-full rounded-xl bg-card/40 border border-dark-border ps-9 pe-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </div>

        {loading ? (
          <div className="text-muted text-center py-10">جاري التحميل...</div>
        ) : visible.length === 0 ? (
          <div className="card border border-dark-border rounded-2xl p-12 text-center text-muted">
            لا توجد ملفات مُشاركة الآن. ابدأ بمشاركة ملفك من{' '}
            <Link href="/library" className="text-primary-light underline">
              مكتبتك
            </Link>
            .
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {visible.map((f) => (
              <SharedFileTile
                key={f.id}
                file={f}
                onOpen={() => handleDownload(f)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function SharedFileTile({
  file,
  onOpen,
}: {
  file: PublicFile;
  onOpen: () => void;
}) {
  const size = file.file_size_bytes
    ? `${(file.file_size_bytes / 1024 / 1024).toFixed(1)} MB`
    : '';
  const uploadedAt = new Date(file.uploaded_at).toLocaleDateString('ar-IQ');
  return (
    <div className="card border border-dark-border rounded-2xl p-4 flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-primary-light" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm line-clamp-2" title={file.title}>
            {file.title}
          </h3>
          <div className="flex items-center gap-3 text-xs text-muted mt-1">
            <span className="flex items-center gap-1">
              <UserIcon className="w-3 h-3" />
              {file.uploader_name || 'عضو'}
            </span>
            {size && <span>·</span>}
            {size && <span>{size}</span>}
          </div>
          <div className="text-xs text-muted mt-0.5">{uploadedAt}</div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-1 mt-1">
        <ReportButton kind="library_file" itemId={file.id} variant="pill" />
        <button
          onClick={onOpen}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-light hover:opacity-80 ps-2"
        >
          <Download className="w-4 h-4" />
          فتح
        </button>
      </div>
    </div>
  );
}

export default function LibraryBrowsePage() {
  return (
    <PlatformGate sectionName="مكتبة المجتمع">
      <LibraryBrowsePageInner />
    </PlatformGate>
  );
}
