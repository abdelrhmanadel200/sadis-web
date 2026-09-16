'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, Upload, ExternalLink, Share2, ImagePlus, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
// يطابق حدود مخزن library-covers وإلا رفضه السيرفر برسالة مبهمة.
const MAX_COVER_BYTES = 5 * 1024 * 1024;
const COVER_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

// نفس قائمتي المواد والصيَغ في نموذج "مكتبة أُلترا" بلوحة التحكم — طلب العميل
// أن يكون نموذج مشاركة الطلاب بنفس الترتيب والحقول.
const SUBJECTS = [
  { id: 'math', label: 'الرياضيات (علمي)' },
  { id: 'math_lit', label: 'الرياضيات (أدبي)' },
  { id: 'physics', label: 'الفيزياء' },
  { id: 'chemistry', label: 'الكيمياء' },
  { id: 'biology', label: 'الأحياء' },
  { id: 'arabic', label: 'العربي' },
  { id: 'english', label: 'الإنجليزي' },
  { id: 'islamic', label: 'الإسلامية' },
  { id: 'history', label: 'التاريخ' },
  { id: 'geography', label: 'الجغرافيا' },
  { id: 'economics', label: 'الاقتصاد' },
];

const FORMATS = [
  { id: 'pdf', label: 'PDF' },
  { id: 'doc', label: 'مستند' },
  { id: 'video', label: 'فيديو' },
  { id: 'link', label: 'رابط' },
];

/**
 * نموذج مشاركة ملف/رابط مع مكتبة سادس — يُدرج بصيغة is_public=true
 * فيظهر للجميع بعد موافقة الإدارة (approved=false افتراضياً).
 */
export default function LibraryShareForm({
  user,
  onShared,
  section = 'community',
  sectionLabel = 'مكتبة سادس',
}: {
  user: User;
  onShared: () => void;
  section?: 'community' | 'ministry';
  sectionLabel?: string;
}) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [subject, setSubject] = useState('math');
  const [format, setFormat] = useState('pdf');
  const [mode, setMode] = useState<'file' | 'link'>('file');
  const [linkUrl, setLinkUrl] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // صورة الغلاف إجبارية لكل ملف (طلب العميل).
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const pickCover = (f: File) => {
    setError(null);
    if (!COVER_TYPES.includes(f.type)) {
      setError('صورة الغلاف يجب أن تكون PNG أو JPG أو WEBP.');
      return;
    }
    if (f.size > MAX_COVER_BYTES) {
      setError('حجم صورة الغلاف أكبر من 5 ميجابايت.');
      return;
    }
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(f);
    setCoverPreview(URL.createObjectURL(f));
  };

  const clearCover = () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(null);
    setCoverPreview(null);
    if (coverInputRef.current) coverInputRef.current.value = '';
  };

  const uploadCover = async (): Promise<string> => {
    if (!coverFile) throw new Error('صورة الغلاف إجبارية');
    const ext = coverFile.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('library-covers')
      .upload(path, coverFile, { contentType: coverFile.type, upsert: false });
    if (upErr) throw upErr;
    return supabase.storage.from('library-covers').getPublicUrl(path).data.publicUrl;
  };

  const resetMeta = () => {
    setTitle('');
    setAuthor('');
    setLinkUrl('');
    clearCover();
  };

  const shareFile = async (file: File) => {
    setError(null);
    setSuccess(null);
    if (!title.trim()) {
      setError('أدخل اسم الملف أولاً');
      return;
    }
    if (!coverFile) {
      setError('صورة الغلاف إجبارية، اختر صورة للملف قبل الرفع.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError('الحد الأقصى لحجم الملف ٥٠ ميجابايت');
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
      const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('user-library')
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (upErr) throw upErr;
      const coverUrl = await uploadCover();
      const { error: insertErr } = await supabase.from('user_library_files').insert({
        user_id: user.id,
        title: title.trim().slice(0, 120),
        author: author.trim() || null,
        subject_id: subject || null,
        format: format || null,
        storage_path: path,
        file_size_bytes: file.size,
        mime_type: file.type || null,
        is_public: true,
        cover_url: coverUrl,
        section,
      });
      if (insertErr) throw insertErr;
      resetMeta();
      setSuccess(`تم استلام ملفك ✅ سيظهر في ${sectionLabel} بعد موافقة الإدارة.`);
      onShared();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر رفع الملف، حاول مرة ثانية');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const shareLink = async () => {
    setError(null);
    setSuccess(null);
    if (!title.trim()) {
      setError('أدخل اسم الملف أولاً');
      return;
    }
    if (!coverFile) {
      setError('صورة الغلاف إجبارية، اختر صورة للملف قبل الإضافة.');
      return;
    }
    if (!/^https?:\/\/.+/i.test(linkUrl.trim())) {
      setError('أدخل رابطاً صحيحاً يبدأ بـ http أو https');
      return;
    }
    setBusy(true);
    try {
      const coverUrl = await uploadCover();
      const { error: insertErr } = await supabase.from('user_library_files').insert({
        user_id: user.id,
        title: title.trim().slice(0, 120),
        author: author.trim() || null,
        subject_id: subject || null,
        format: format || 'link',
        external_url: linkUrl.trim(),
        is_public: true,
        cover_url: coverUrl,
        section,
      });
      if (insertErr) throw insertErr;
      resetMeta();
      setSuccess(`تم استلام الرابط ✅ سيظهر في ${sectionLabel} بعد موافقة الإدارة.`);
      onShared();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر إضافة الرابط، حاول مرة ثانية');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card border border-dark-border rounded-2xl p-5 mb-8">
      <h2 className="font-bold text-lg mb-1 flex items-center gap-2">
        <Share2 className="w-5 h-5 text-primary-light" />
        شارك ملفاً مع {sectionLabel}
      </h2>
      <p className="text-sm text-muted mb-4">
        املأ معلومات الملف ثم ارفعه أو أضف رابطه — يظهر لبقية الطلاب بعد موافقة الإدارة.
      </p>

      {/* معلومات الملف — نفس ترتيب نموذج مكتبة أُلترا */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-muted mb-1">العنوان</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ملزمة الرياضيات — الفصل الأول"
            className="w-full rounded-xl bg-card/40 border border-dark-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">الأستاذ / المصدر</label>
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="أ. حسين علي"
            className="w-full rounded-xl bg-card/40 border border-dark-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">القسم المختص</label>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-xl bg-card/40 border border-dark-border px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {SUBJECTS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">نوع الملف</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="w-full rounded-xl bg-card/40 border border-dark-border px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {FORMATS.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* صورة الغلاف (إجبارية) */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-muted mb-1">
          صورة الغلاف <span className="text-red-400">*</span>
        </label>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) pickCover(f); }}
        />
        {coverPreview ? (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverPreview} alt="الغلاف" className="h-32 w-24 rounded-lg object-cover border border-dark-border" />
            <button
              type="button"
              onClick={clearCover}
              aria-label="إزالة الغلاف"
              className="absolute -top-2 -start-2 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            className="h-32 w-24 rounded-lg border-2 border-dashed border-dark-border flex flex-col items-center justify-center gap-1 text-xs text-muted hover:border-primary hover:text-primary-light transition"
          >
            <ImagePlus className="w-5 h-5" />
            اختر غلاف
          </button>
        )}
      </div>

      {/* رفع ملف أو إضافة رابط */}
      <div className="inline-flex gap-1 p-1 rounded-xl bg-card/40 border border-dark-border mb-4">
        <button
          onClick={() => { setMode('file'); setError(null); }}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
            mode === 'file' ? 'bg-primary text-white' : 'text-muted'
          }`}
        >
          رفع ملف
        </button>
        <button
          onClick={() => { setMode('link'); setError(null); }}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
            mode === 'link' ? 'bg-primary text-white' : 'text-muted'
          }`}
        >
          إضافة رابط
        </button>
      </div>

      {mode === 'file' ? (
        <div>
          <p className="text-sm text-muted mb-3">PDF أو صورة أو ملاحظات — حد أقصى ٥٠ ميجابايت.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/*,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              // تفريغ الحقل فورا: اختيار نفس الملف بعد خطأ يطلق الحدث من جديد.
              e.target.value = '';
              if (f) void shareFile(f);
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={busy || !acceptedTerms}
            className="inline-flex items-center gap-2 bg-primary text-white font-bold px-5 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50 transition"
          >
            {busy ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> جاري الرفع...</>
            ) : (
              <><Upload className="w-4 h-4" /> اختر ملف</>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-3 max-w-xl">
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            dir="ltr"
            placeholder="https://drive.google.com/..."
            className="w-full rounded-xl bg-card/40 border border-dark-border px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={() => void shareLink()}
            disabled={busy || !acceptedTerms}
            className="inline-flex items-center gap-2 bg-primary text-white font-bold px-5 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50 transition"
          >
            {busy ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> جاري الإضافة...</>
            ) : (
              <><ExternalLink className="w-4 h-4" /> أضف الرابط</>
            )}
          </button>
        </div>
      )}

      <label className="mt-4 flex items-center gap-2 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          checked={acceptedTerms}
          onChange={(e) => setAcceptedTerms(e.target.checked)}
          className="w-4 h-4 accent-primary"
        />
        <span>
          أوافق على{' '}
          <Link href="/terms" className="text-primary hover:underline">شروط الاستخدام</Link>
          {' '}و{' '}
          <Link href="/copyright" className="text-primary hover:underline">سياسة حقوق النشر</Link>
        </span>
      </label>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {success && <p className="mt-3 text-sm text-emerald-400">{success}</p>}
    </section>
  );
}
