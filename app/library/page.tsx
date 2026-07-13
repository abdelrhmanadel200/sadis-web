'use client';

import PlatformGate from '@/components/PlatformGate';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Heart,
  ArrowRight,
  ExternalLink,
  Play,
  FileText,
  Library as LibraryIcon,
  Upload,
  Trash2,
  Download,
  Loader2,
  Pencil,
  Globe,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/providers/AuthProvider';
import { toggleSave, youtubeEmbedUrl, youtubeThumb } from '@/lib/saved-items';

interface SavedRow {
  id: string;
  kind: 'book' | 'lecture';
  item_id: string;
  saved_at: string;
}

interface Book {
  id: string;
  title: string;
  description: string | null;
  author: string | null;
  external_url: string;
  cover_url: string | null;
  format: string | null;
}

interface Lecture {
  id: string;
  title: string;
  description: string | null;
  teacher_name: string | null;
  video_url: string;
  thumbnail_url: string | null;
}

interface UserFile {
  id: string;
  title: string;
  description: string | null;
  storage_path: string | null;
  external_url: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  uploaded_at: string;
  is_public: boolean;
}

interface SavedBook { kind: 'book'; row: Book }
interface SavedLecture { kind: 'lecture'; row: Lecture }
type SavedItem = SavedBook | SavedLecture;

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * "مكتبتي":
 *   - الكتب والمحاضرات اللي حفظها المستخدم بزرار القلب
 *   - الملفات اللي رفعها بنفسه (PDF / صور / ملاحظات)
 *
 * كل المحفوظات والملفات خاصة بكل مستخدم لوحده عبر RLS.
 */
function LibraryPageInner() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [files, setFiles] = useState<UserFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<Lecture | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Upload method: file upload or external link (matching admin books).
  const [uploadMode, setUploadMode] = useState<'file' | 'link'>('file');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  // Whether the new item is shared to the community library (public).
  const [shareToCommunity, setShareToCommunity] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Fetch saved items + user files in parallel.
    const [savedRes, filesRes] = await Promise.all([
      supabase
        .from('saved_items')
        .select('*')
        .eq('user_id', user.id)
        .order('saved_at', { ascending: false }),
      supabase
        .from('user_library_files')
        .select('id, title, description, storage_path, external_url, file_size_bytes, mime_type, uploaded_at, is_public')
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false }),
    ]);

    const savedRows = (savedRes.data ?? []) as SavedRow[];
    const bookIds = savedRows.filter((r) => r.kind === 'book').map((r) => r.item_id);
    const lectureIds = savedRows.filter((r) => r.kind === 'lecture').map((r) => r.item_id);

    const [{ data: books }, { data: lectures }] = await Promise.all([
      bookIds.length > 0
        ? supabase.from('books').select('*').in('id', bookIds)
        : Promise.resolve({ data: [] as Book[] }),
      lectureIds.length > 0
        ? supabase.from('lectures').select('*').in('id', lectureIds)
        : Promise.resolve({ data: [] as Lecture[] }),
    ]);
    const bookMap = new Map<string, Book>((books ?? []).map((b) => [b.id, b as Book]));
    const lectureMap = new Map<string, Lecture>(
      (lectures ?? []).map((l) => [l.id, l as Lecture]),
    );

    const merged: SavedItem[] = [];
    for (const s of savedRows) {
      if (s.kind === 'book') {
        const row = bookMap.get(s.item_id);
        if (row) merged.push({ kind: 'book', row });
      } else {
        const row = lectureMap.get(s.item_id);
        if (row) merged.push({ kind: 'lecture', row });
      }
    }
    setSavedItems(merged);
    setFiles((filesRes.data ?? []) as UserFile[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUnsave = useCallback(
    async (kind: 'book' | 'lecture', id: string) => {
      if (!user) return;
      setSavedItems((prev) => prev.filter((i) => !(i.kind === kind && i.row.id === id)));
      await toggleSave(supabase, user.id, kind, id, true);
    },
    [user],
  );

  const handleUpload = async (file: File) => {
    if (!user) return;
    setUploadError(null);
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadError('الحد الأقصى لحجم الملف ٥٠ ميجابايت');
      return;
    }
    setUploading(true);
    try {
      // Path namespaces by user-id so RLS policies match.
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
      const safeBase = file.name
        .replace(/\.[^.]+$/, '')
        .replace(/[^A-Za-z0-9_؀-ۿ\-. ]+/g, '_')
        .slice(0, 80);
      const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('user-library')
        .upload(path, file, {
          contentType: file.type || undefined,
          upsert: false,
        });
      if (upErr) throw upErr;
      const { error: insertErr } = await supabase.from('user_library_files').insert({
        user_id: user.id,
        title: safeBase || file.name,
        storage_path: path,
        file_size_bytes: file.size,
        mime_type: file.type || null,
        is_public: shareToCommunity,
      });
      if (insertErr) throw insertErr;
      await load();
    } catch (e) {
      setUploadError(
        e instanceof Error ? e.message : 'تعذّر رفع الملف، حاول مرة ثانية',
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Add a library entry by external link (no file upload), mirroring the
  // admin books system where a book can be a link or an uploaded file.
  const handleAddLink = async () => {
    if (!user) return;
    setUploadError(null);
    const title = linkTitle.trim();
    const url = linkUrl.trim();
    if (!title) {
      setUploadError('أدخل عنواناً للرابط');
      return;
    }
    if (!/^https?:\/\/.+/i.test(url)) {
      setUploadError('أدخل رابطاً صحيحاً يبدأ بـ http أو https');
      return;
    }
    setUploading(true);
    try {
      const { error: insertErr } = await supabase.from('user_library_files').insert({
        user_id: user.id,
        title: title.slice(0, 120),
        external_url: url,
        is_public: shareToCommunity,
      });
      if (insertErr) throw insertErr;
      setLinkTitle('');
      setLinkUrl('');
      await load();
    } catch (e) {
      setUploadError(
        e instanceof Error ? e.message : 'تعذّر إضافة الرابط، حاول مرة ثانية',
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (f: UserFile) => {
    // Link entries just open in a new tab.
    if (f.external_url) {
      window.open(f.external_url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!f.storage_path) return;
    // Create a short-lived signed URL because the bucket is private.
    const { data, error } = await supabase.storage
      .from('user-library')
      .createSignedUrl(f.storage_path, 60 * 30); // 30 min
    if (error || !data?.signedUrl) {
      alert('تعذّر فتح الملف');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDeleteFile = async (f: UserFile) => {
    if (!confirm('حذف العنصر نهائياً؟')) return;
    // Optimistic remove + storage cleanup (files only) + row delete.
    setFiles((prev) => prev.filter((x) => x.id !== f.id));
    if (f.storage_path) {
      await supabase.storage.from('user-library').remove([f.storage_path]);
    }
    await supabase.from('user_library_files').delete().eq('id', f.id);
  };

  const handleRename = async (f: UserFile) => {
    const next = prompt('اكتب اسم جديد للملف:', f.title);
    if (!next || next.trim() === '' || next === f.title) return;
    const title = next.trim().slice(0, 120);
    setFiles((prev) => prev.map((x) => (x.id === f.id ? { ...x, title } : x)));
    await supabase.from('user_library_files').update({ title }).eq('id', f.id);
  };

  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-muted">جاري التحميل...</div>
      </main>
    );
  }
  if (!user) return null;

  const empty = !loading && savedItems.length === 0 && files.length === 0;

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

        <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2 flex items-center gap-2">
              <LibraryIcon className="w-7 h-7 text-primary-light" />
              مكتبتي
            </h1>
            <p className="text-muted">
              المحفوظات بزر القلب + ملفاتك التي رفعتها بنفسك.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link
              href="/library/browse"
              className="text-sm font-bold px-4 py-2 rounded-xl bg-primary text-white hover:opacity-90 transition"
            >
              مكتبة المجتمع
            </Link>
            <Link
              href="/books"
              className="text-sm font-semibold px-4 py-2 rounded-xl border border-dark-border hover:border-primary/60 transition"
            >
              تصفّح الكتب
            </Link>
            <Link
              href="/lectures"
              className="text-sm font-semibold px-4 py-2 rounded-xl border border-dark-border hover:border-primary/60 transition"
            >
              تصفّح المحاضرات
            </Link>
          </div>
        </header>

        {/* Upload zone — file OR link, like the admin books system */}
        <section className="mb-8 card border border-dashed border-primary/40 rounded-2xl p-5">
          <h2 className="font-bold text-lg mb-1">أضف إلى المكتبة</h2>
          <p className="text-sm text-muted mb-4">
            ارفع ملفاً أو أضف رابطاً خارجياً — تماماً مثل إضافة كتاب. يمكنك
            مشاركته مع مكتبة المجتمع ليستفيد منه بقية الطلاب.
          </p>

          {/* Mode toggle */}
          <div className="inline-flex gap-1 p-1 rounded-xl bg-card/40 border border-dark-border mb-4">
            <button
              onClick={() => { setUploadMode('file'); setUploadError(null); }}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                uploadMode === 'file' ? 'bg-primary text-white' : 'text-muted'
              }`}
            >
              رفع ملف
            </button>
            <button
              onClick={() => { setUploadMode('link'); setUploadError(null); }}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                uploadMode === 'link' ? 'bg-primary text-white' : 'text-muted'
              }`}
            >
              إضافة رابط
            </button>
          </div>

          {uploadMode === 'file' ? (
            <div>
              <p className="text-sm text-muted mb-3">
                PDF أو صورة أو ملاحظات — حد أقصى ٥٠ ميجابايت.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/*,text/plain"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUpload(f);
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 bg-primary text-white font-bold px-5 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50 transition"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    جاري الرفع...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    اختر ملف
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-3 max-w-xl">
              <input
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                placeholder="عنوان الملف / الكتاب"
                className="input-field w-full rounded-xl px-4 py-2.5 outline-none focus:border-primary"
              />
              <input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                dir="ltr"
                placeholder="https://drive.google.com/..."
                className="input-field w-full rounded-xl px-4 py-2.5 outline-none focus:border-primary"
              />
              <button
                onClick={() => void handleAddLink()}
                disabled={uploading}
                className="inline-flex items-center gap-2 bg-primary text-white font-bold px-5 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50 transition"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    جاري الإضافة...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4" />
                    أضف الرابط
                  </>
                )}
              </button>
            </div>
          )}

          {/* Share to community */}
          <label className="mt-4 flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={shareToCommunity}
              onChange={(e) => setShareToCommunity(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <span className="flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-primary-light" />
              مشاركة مع مكتبة المجتمع (يراها بقية الطلاب)
            </span>
          </label>

          {uploadError && (
            <p className="mt-3 text-sm text-error">{uploadError}</p>
          )}
        </section>

        {/* My uploaded files */}
        {files.length > 0 && (
          <section className="mb-10">
            <h2 className="font-bold text-lg mb-3">ملفاتي ({files.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {files.map((f) => (
                <UserFileTile
                  key={f.id}
                  file={f}
                  onOpen={() => handleDownload(f)}
                  onDelete={() => handleDeleteFile(f)}
                  onRename={() => handleRename(f)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Saved */}
        {loading ? (
          <div className="text-muted text-center py-10">جاري التحميل...</div>
        ) : empty ? (
          <div className="card border border-dark-border rounded-2xl p-12 text-center">
            <Heart className="w-12 h-12 mx-auto text-muted mb-3" />
            <p className="text-muted mb-4">
              مكتبتك فارغة. ارفع ملفاً، أو ادخل إلى الكتب أو المحاضرات واضغط على القلب لتحفظها هنا.
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Link
                href="/books"
                className="text-sm font-semibold px-4 py-2 rounded-xl bg-primary text-white hover:opacity-90"
              >
                تصفّح الكتب
              </Link>
              <Link
                href="/lectures"
                className="text-sm font-semibold px-4 py-2 rounded-xl border border-dark-border hover:border-primary/60 transition"
              >
                تصفّح المحاضرات
              </Link>
            </div>
          </div>
        ) : savedItems.length > 0 ? (
          <section>
            <h2 className="font-bold text-lg mb-3">المحفوظات ({savedItems.length})</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {savedItems.map((i) =>
                i.kind === 'book' ? (
                  <BookTile
                    key={`book-${i.row.id}`}
                    book={i.row}
                    onUnsave={() => handleUnsave('book', i.row.id)}
                  />
                ) : (
                  <LectureTile
                    key={`lecture-${i.row.id}`}
                    lecture={i.row}
                    onOpen={() => setPlaying(i.row)}
                    onUnsave={() => handleUnsave('lecture', i.row.id)}
                  />
                ),
              )}
            </div>
          </section>
        ) : null}
      </div>

      {playing && (
        <VideoModal lecture={playing} onClose={() => setPlaying(null)} />
      )}
    </main>
  );
}

function UserFileTile({
  file,
  onOpen,
  onDelete,
  onRename,
}: {
  file: UserFile;
  onOpen: () => void;
  onDelete: () => void;
  onRename: () => void;
}) {
  const size = file.file_size_bytes
    ? `${(file.file_size_bytes / 1024 / 1024).toFixed(1)} MB`
    : '';
  const uploadedAt = new Date(file.uploaded_at).toLocaleDateString('ar-IQ');
  const isLink = !!file.external_url;
  return (
    <div className="card border border-dark-border rounded-2xl p-3 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
        {isLink ? (
          <ExternalLink className="w-5 h-5 text-primary-light" />
        ) : (
          <FileText className="w-5 h-5 text-primary-light" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm truncate" title={file.title}>
          {file.title}
        </h3>
        <div className="text-xs text-muted flex items-center gap-2 flex-wrap">
          {size && <span>{size}</span>}
          {size && <span>·</span>}
          <span>{uploadedAt}</span>
          <span>·</span>
          <span>{isLink ? 'رابط' : 'ملف'}</span>
          {/* Show the public badge ONLY for items the user shared. */}
          {file.is_public && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1 text-primary-light">
                <Globe className="w-3 h-3" />
                عام
              </span>
            </>
          )}
        </div>
      </div>
      <button
        onClick={onRename}
        aria-label="إعادة تسمية"
        className="p-1.5 rounded-full hover:bg-primary/10 transition"
      >
        <Pencil className="w-4 h-4 text-muted" />
      </button>
      <button
        onClick={onOpen}
        aria-label="فتح"
        className="p-1.5 rounded-full hover:bg-primary/10 transition"
      >
        <Download className="w-4 h-4 text-primary-light" />
      </button>
      <button
        onClick={onDelete}
        aria-label="حذف"
        className="p-1.5 rounded-full hover:bg-error/10 transition"
      >
        <Trash2 className="w-4 h-4 text-error" />
      </button>
    </div>
  );
}

function BookTile({
  book,
  onUnsave,
}: {
  book: Book;
  onUnsave: () => void;
}) {
  return (
    <div className="card border border-dark-border rounded-2xl overflow-hidden flex flex-col">
      <a
        href={book.external_url}
        target="_blank"
        rel="noopener noreferrer"
        className="relative aspect-[3/4] bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center"
      >
        {book.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
        ) : (
          <FileText className="w-12 h-12 text-primary-light/70" />
        )}
        <div className="absolute top-2 start-2 flex items-center gap-1 text-[10px] bg-black/60 text-white px-2 py-1 rounded-full">
          <ExternalLink className="w-3 h-3" />
          فتح
        </div>
      </a>
      <div className="p-3 flex-1 flex flex-col">
        <h3 className="font-cairo font-bold text-sm line-clamp-2 mb-1">{book.title}</h3>
        {book.author && (
          <p className="text-xs text-muted line-clamp-1 mb-2">{book.author}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-[11px] text-muted uppercase">
            {book.format ?? 'pdf'}
          </span>
          <button
            onClick={onUnsave}
            aria-label="إزالة من مكتبتي"
            className="p-1.5 rounded-full hover:bg-primary/10 transition"
          >
            <Heart className="w-4 h-4 fill-error text-error" />
          </button>
        </div>
      </div>
    </div>
  );
}

function LectureTile({
  lecture,
  onOpen,
  onUnsave,
}: {
  lecture: Lecture;
  onOpen: () => void;
  onUnsave: () => void;
}) {
  const thumb = lecture.thumbnail_url || youtubeThumb(lecture.video_url) || '';
  return (
    <div className="card border border-dark-border rounded-2xl overflow-hidden flex flex-col group">
      <button onClick={onOpen} className="relative aspect-video bg-card/40 block">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={lecture.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5" />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="w-12 h-12 rounded-full bg-white/95 flex items-center justify-center">
            <Play className="w-5 h-5 text-primary ms-0.5" fill="currentColor" />
          </div>
        </div>
      </button>
      <div className="p-3 flex-1 flex flex-col">
        <h3 className="font-cairo font-bold text-sm line-clamp-2 mb-1">{lecture.title}</h3>
        {lecture.teacher_name && (
          <p className="text-xs text-muted line-clamp-1 mb-2">{lecture.teacher_name}</p>
        )}
        <div className="mt-auto flex items-center justify-end pt-2">
          <button
            onClick={onUnsave}
            aria-label="إزالة من مكتبتي"
            className="p-1.5 rounded-full hover:bg-primary/10 transition"
          >
            <Heart className="w-4 h-4 fill-error text-error" />
          </button>
        </div>
      </div>
    </div>
  );
}

function VideoModal({
  lecture,
  onClose,
}: {
  lecture: Lecture;
  onClose: () => void;
}) {
  const embedUrl = youtubeEmbedUrl(lecture.video_url);
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl bg-card rounded-2xl overflow-hidden border border-dark-border"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border">
          <div>
            <h3 className="font-bold">{lecture.title}</h3>
            {lecture.teacher_name && (
              <p className="text-xs text-muted">{lecture.teacher_name}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="w-9 h-9 rounded-full hover:bg-primary/10 flex items-center justify-center text-2xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="aspect-video bg-black">
          {embedUrl ? (
            <iframe
              src={embedUrl + '&autoplay=1'}
              title={lecture.title}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted text-sm">
              لا يمكن تشغيل هذا الفيديو
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LibraryPage() {
  return (
    <PlatformGate sectionName="المكتبة">
      <LibraryPageInner />
    </PlatformGate>
  );
}
