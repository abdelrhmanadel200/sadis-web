'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Plus,
  Loader2,
  NotebookPen,
  FileText,
  Trash2,
  Search,
  Upload,
  ExternalLink,
  AlertCircle,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/providers/AuthProvider';

interface Workbook {
  id: string;
  subject: string | null;
  title: string;
  kind: string;
  pdf_path: string | null;
  pdf_size_bytes: number | null;
  content: { pages?: unknown[] } | null;
  updated_at: string;
}

// الحد الأقصى لملف الـ PDF المستورد — مفروض أيضاً على مستوى المخزن نفسه.
const MAX_PDF_BYTES = 10 * 1024 * 1024;

// اقتراحات فقط: الطالب يكتب أي مادة يريدها بحرية.
const SUBJECT_SUGGESTIONS = [
  'الرياضيات', 'الفيزياء', 'الكيمياء', 'الأحياء', 'العربي',
  'الإنجليزي', 'الإسلامية', 'التاريخ', 'الجغرافيا', 'الاقتصاد',
];

export default function WorkbooksPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [rows, setRows] = useState<Workbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newTitle, setNewTitle] = useState('');

  const [importing, setImporting] = useState(false);
  const pdfInput = useRef<HTMLInputElement | null>(null);
  // حارس فوري: حالة React لا تتحدث بين ضغطتَي Enter متتاليتين، فبدونه
  // ينشئ الطالب دفترين متطابقين.
  const creatingRef = useRef(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login?next=' + encodeURIComponent('/workbooks'));
  }, [authLoading, user, router]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from('workbooks')
      .select('id, subject, title, kind, pdf_path, pdf_size_bytes, content, updated_at')
      .order('updated_at', { ascending: false });
    if (err) setError('تعذّر تحميل الدفاتر.');
    setRows((data ?? []) as Workbook[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const createWorkbook = async () => {
    if (!user || creatingRef.current) return;
    const title = newTitle.trim();
    if (!title) { setError('اكتب عنوان الدفتر أولاً.'); return; }
    creatingRef.current = true;
    setCreating(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('workbooks')
      .insert({
        user_id: user.id,
        title: title.slice(0, 120),
        subject: newSubject.trim().slice(0, 60) || null,
        kind: 'editor',
        content: { pages: [{ id: 'p1', doc: { type: 'doc', content: [{ type: 'paragraph' }] } }] },
      })
      .select('id')
      .single();
    setCreating(false);
    if (err || !data) {
      creatingRef.current = false;
      setError('تعذّر إنشاء الدفتر، حاول مرة ثانية.');
      return;
    }
    router.push(`/workbooks/${data.id}`);
  };

  const importPdf = async (file: File) => {
    if (!user) return;
    setError(null);
    if (file.type !== 'application/pdf') {
      setError('اختر ملف PDF فقط.');
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setError('حجم الملف أكبر من 10 ميجابايت. اضغط الملف أو قسّمه ثم أعد المحاولة.');
      return;
    }
    setImporting(true);
    try {
      const path = `${user.id}/${crypto.randomUUID()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from('workbooks')
        .upload(path, file, { contentType: 'application/pdf', upsert: false });
      if (upErr) throw upErr;
      const baseName = file.name.replace(/\.pdf$/i, '').slice(0, 120) || 'دفتر مستورد';
      const { error: insErr } = await supabase.from('workbooks').insert({
        user_id: user.id,
        title: baseName,
        subject: null,
        kind: 'pdf',
        pdf_path: path,
        pdf_size_bytes: file.size,
        content: { pages: [] },
      });
      if (insErr) throw insErr;
      await load();
    } catch {
      setError('تعذّر رفع الملف، حاول مرة ثانية.');
    } finally {
      setImporting(false);
      if (pdfInput.current) pdfInput.current.value = '';
    }
  };

  const remove = async (wb: Workbook) => {
    if (!confirm(`حذف "${wb.title}" نهائياً؟`)) return;
    setError(null);
    // احذف ملفات الدفتر أيضاً: الصور المضمّنة داخل الصفحات وملف الـ PDF
    // المستورد. بدون ذلك تبقى في المخزن إلى الأبد وتستهلك المساحة.
    const paths = collectStoragePaths(wb);
    if (paths.length > 0) {
      const { error: rmErr } = await supabase.storage.from('workbooks').remove(paths);
      if (rmErr) {
        setError('تعذّر حذف ملفات الدفتر، حاول مرة ثانية.');
        return;
      }
    }
    const { error: delErr } = await supabase.from('workbooks').delete().eq('id', wb.id);
    if (delErr) {
      setError('تعذّر حذف الدفتر، حاول مرة ثانية.');
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== wb.id));
  };

  const openPdf = (wb: Workbook) => {
    if (!wb.pdf_path) return;
    const { data } = supabase.storage.from('workbooks').getPublicUrl(wb.pdf_path);
    window.open(data.publicUrl, '_blank', 'noopener,noreferrer');
  };

  const subjects = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.subject) set.add(r.subject);
    return Array.from(set).sort();
  }, [rows]);

  const visible = rows.filter((r) => {
    if (subjectFilter !== 'all' && (r.subject ?? '') !== subjectFilter) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return `${r.title} ${r.subject ?? ''}`.toLowerCase().includes(q);
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

        <header className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 flex items-center gap-2">
            <NotebookPen className="w-7 h-7 text-primary-light" />
            حقيبة الدفاتر
          </h1>
          <p className="text-muted">
            أنشئ دفترك الخاص، اكتب أسئلتك وأجوبتك، أضف صوراً وفيديوهات يوتيوب، وصدّره PDF متى شئت.
          </p>
        </header>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* أدوات */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <button
            onClick={() => { setNewOpen(true); setNewTitle(''); setNewSubject(''); setError(null); }}
            className="inline-flex items-center gap-2 rounded-xl bg-primary text-white font-bold px-4 py-2.5 text-sm hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            دفتر جديد
          </button>
          <input
            ref={pdfInput}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void importPdf(f); }}
          />
          <button
            onClick={() => pdfInput.current?.click()}
            disabled={importing}
            className="inline-flex items-center gap-2 rounded-xl border border-dark-border px-4 py-2.5 text-sm hover:border-primary disabled:opacity-50"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {importing ? 'جاري الرفع...' : 'استيراد دفتر PDF'}
          </button>
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث في دفاترك..."
              className="w-full rounded-xl bg-card/40 border border-dark-border ps-9 pe-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* تصفية حسب المادة */}
        {subjects.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {['all', ...subjects].map((s) => (
              <button
                key={s}
                onClick={() => setSubjectFilter(s)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition ${
                  subjectFilter === s
                    ? 'bg-primary text-white border-primary'
                    : 'border-dark-border text-muted hover:border-primary'
                }`}
              >
                {s === 'all' ? `الكل (${rows.length})` : `${s} (${rows.filter((r) => r.subject === s).length})`}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-muted flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> جاري التحميل...
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-dark-border bg-card/30 p-12 text-center">
            <NotebookPen className="w-10 h-10 text-muted mx-auto mb-3" />
            <p className="text-muted mb-4">
              {rows.length === 0
                ? 'حقيبتك فارغة. ابدأ بإنشاء دفترك الأول.'
                : 'لا توجد نتائج مطابقة.'}
            </p>
            {rows.length === 0 && (
              <button
                onClick={() => setNewOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-primary text-white font-bold px-5 py-2.5 text-sm hover:opacity-90"
              >
                <Plus className="w-4 h-4" />
                دفتر جديد
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map((wb) => (
              <WorkbookCard
                key={wb.id}
                wb={wb}
                onOpen={() => (wb.kind === 'pdf' ? openPdf(wb) : router.push(`/workbooks/${wb.id}`))}
                onDelete={() => remove(wb)}
              />
            ))}
          </div>
        )}
      </div>

      {/* نافذة إنشاء دفتر */}
      {newOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setNewOpen(false)}>
          <div
            className="w-full max-w-md rounded-2xl border border-dark-border bg-background p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">دفتر جديد</h2>
              <button onClick={() => setNewOpen(false)} aria-label="إغلاق" className="text-muted hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">المادة</label>
                <input
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  list="wb-subjects"
                  placeholder="كيمياء"
                  className="w-full rounded-xl bg-card/40 border border-dark-border px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
                <datalist id="wb-subjects">
                  {SUBJECT_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">العنوان</label>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void createWorkbook(); }}
                  placeholder="واجبات الفصل الأول"
                  className="w-full rounded-xl bg-card/40 border border-dark-border px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
              <p className="text-xs text-muted">
                اكتب المادة والعنوان كما تحب — لا توجد قائمة مفروضة عليك.
              </p>
              <button
                onClick={createWorkbook}
                disabled={creating}
                className="w-full rounded-xl bg-primary text-white font-bold px-5 py-2.5 text-sm hover:opacity-90 disabled:opacity-50"
              >
                {creating ? 'جاري الإنشاء...' : 'إنشاء وفتح الدفتر'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/** بادئة روابط المخزن العام لهذا المشروع — لاستخراج المسار من الرابط المحفوظ. */
const PUBLIC_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}/storage/v1/object/public/workbooks/`;

/** يجمع كل ملفات الدفتر في المخزن: صور الصفحات + ملف PDF المستورد. */
function collectStoragePaths(wb: Workbook): string[] {
  const paths = new Set<string>();
  if (wb.pdf_path) paths.add(wb.pdf_path);

  const visit = (node: unknown) => {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!node || typeof node !== 'object') return;
    const n = node as { type?: string; attrs?: { src?: string }; content?: unknown };
    if (n.type === 'image' && typeof n.attrs?.src === 'string' && n.attrs.src.startsWith(PUBLIC_PREFIX)) {
      const path = decodeURIComponent(n.attrs.src.slice(PUBLIC_PREFIX.length).split('?')[0]);
      if (path) paths.add(path);
    }
    if (n.content) visit(n.content);
  };
  visit(wb.content?.pages);
  return Array.from(paths);
}

function WorkbookCard({
  wb,
  onOpen,
  onDelete,
}: {
  wb: Workbook;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const isPdf = wb.kind === 'pdf';
  const pageCount = Array.isArray(wb.content?.pages) ? wb.content!.pages!.length : 0;
  const size = wb.pdf_size_bytes ? `${(wb.pdf_size_bytes / 1024 / 1024).toFixed(1)} MB` : '';
  return (
    <div className="group rounded-2xl border border-dark-border bg-card/40 p-4 flex flex-col gap-3 hover:border-primary/60 transition">
      <button onClick={onOpen} className="text-start flex items-start gap-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${isPdf ? 'bg-red-500/15' : 'bg-primary/15'}`}>
          {isPdf ? <FileText className="w-5 h-5 text-red-400" /> : <NotebookPen className="w-5 h-5 text-primary-light" />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-sm line-clamp-2">{wb.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            {wb.subject && <span className="rounded-full bg-primary/15 text-primary-light px-2 py-0.5">{wb.subject}</span>}
            <span>{isPdf ? `ملف PDF${size ? ` · ${size}` : ''}` : `${pageCount} صفحة`}</span>
          </div>
          <div className="mt-1 text-xs text-muted">
            آخر تعديل: {new Date(wb.updated_at).toLocaleDateString('ar-IQ')}
          </div>
        </div>
      </button>
      <div className="flex items-center justify-between border-t border-dark-border pt-2">
        <button onClick={onOpen} className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-light hover:opacity-80">
          {isPdf ? <ExternalLink className="w-3.5 h-3.5" /> : <NotebookPen className="w-3.5 h-3.5" />}
          {isPdf ? 'فتح الملف' : 'فتح الدفتر'}
        </button>
        <button onClick={onDelete} aria-label="حذف" className="text-muted hover:text-red-400 p-1">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
