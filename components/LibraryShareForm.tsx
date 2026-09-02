'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, Upload, ExternalLink, Share2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

// نفس قائمتي المواد والصيَغ في نموذج "مكتبة أُلترا" بلوحة التحكم — طلب العميل
// أن يكون نموذج مشاركة الطلاب بنفس الترتيب والحقول.
const SUBJECTS = [
  { id: 'math', label: 'الرياضيات' },
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
}: {
  user: User;
  onShared: () => void;
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

  const resetMeta = () => {
    setTitle('');
    setAuthor('');
    setLinkUrl('');
  };

  const shareFile = async (file: File) => {
    setError(null);
    setSuccess(null);
    if (!title.trim()) {
      setError('أدخل اسم الملف أولاً');
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
      });
      if (insertErr) throw insertErr;
      resetMeta();
      setSuccess('تم استلام ملفك ✅ سيظهر في مكتبة سادس بعد موافقة الإدارة.');
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
    if (!/^https?:\/\/.+/i.test(linkUrl.trim())) {
      setError('أدخل رابطاً صحيحاً يبدأ بـ http أو https');
      return;
    }
    setBusy(true);
    try {
      const { error: insertErr } = await supabase.from('user_library_files').insert({
        user_id: user.id,
        title: title.trim().slice(0, 120),
        author: author.trim() || null,
        subject_id: subject || null,
        format: format || 'link',
        external_url: linkUrl.trim(),
        is_public: true,
      });
      if (insertErr) throw insertErr;
      resetMeta();
      setSuccess('تم استلام الرابط ✅ سيظهر في مكتبة سادس بعد موافقة الإدارة.');
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
        شارك ملفاً مع مكتبة سادس
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
