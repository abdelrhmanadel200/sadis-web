'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { EditorContent, useEditor } from '@tiptap/react';
import { EditorState } from '@tiptap/pm/state';
import { generateHTML } from '@tiptap/html';
import DOMPurify from 'isomorphic-dompurify';
import {
  ArrowRight,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading2,
  ImagePlus,
  Youtube as YoutubeIcon,
  HelpCircle,
  CheckCircle2,
  Undo2,
  Redo2,
  Download,
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Check,
  AlertCircle,
  Palette,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  editorExtensions,
  workbookExtensions,
  newPage,
  EMPTY_DOC,
  type WorkbookPage,
} from './extensions';
import styles from './workbook.module.css';

export interface WorkbookRow {
  id: string;
  user_id: string;
  subject: string | null;
  title: string;
  kind: string;
  content: { pages?: WorkbookPage[] } | null;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
// لا بد أن تطابق allowed_mime_types في مخزن workbooks، وإلا رفض السيرفر الملف
// برسالة عامة مربكة للطالب.
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
const MAX_PAGES = 60;
const COLORS = ['#1a1a1a', '#1d4ed8', '#b91c1c', '#047857', '#7c3aed', '#b45309'];
const LINE_HEIGHT_PX = 32;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** يضمن أن الدفتر يبدأ دائماً بصفحة واحدة على الأقل. */
function normalizePages(content: WorkbookRow['content']): WorkbookPage[] {
  const raw = Array.isArray(content?.pages) ? content!.pages! : [];
  const clean = raw.filter((p) => p && typeof p === 'object' && p.doc);
  return clean.length > 0 ? clean : [newPage('p1')];
}

export default function WorkbookEditor({
  workbook,
  studentName,
  studentEmail,
}: {
  workbook: WorkbookRow;
  studentName: string;
  studentEmail: string;
}) {
  const [pages, setPages] = useState<WorkbookPage[]>(() => normalizePages(workbook.content));
  const [current, setCurrent] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [title, setTitle] = useState(workbook.title);
  const [subject, setSubject] = useState(workbook.subject ?? '');
  const [notice, setNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  const [uploading, setUploading] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);

  // مراجع تحمل آخر قيمة داخل مؤقّت الحفظ (لا تعتمد على قيم الـ render القديمة).
  const pagesRef = useRef(pages);
  const currentRef = useRef(current);
  const titleRef = useRef(title);
  const subjectRef = useRef(subject);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const switching = useRef(false);
  const imageInput = useRef<HTMLInputElement | null>(null);
  // ترقيم الحفظات: استجابة قديمة بطيئة يجب ألا تقرر حالة المؤشر.
  const saveSeq = useRef(0);
  const lastAppliedSeq = useRef(0);

  useEffect(() => { pagesRef.current = pages; }, [pages]);
  useEffect(() => { currentRef.current = current; }, [current]);
  useEffect(() => { titleRef.current = title; }, [title]);
  useEffect(() => { subjectRef.current = subject; }, [subject]);

  const persist = useCallback(async () => {
    const seq = ++saveSeq.current;
    setSaveState('saving');
    const { error } = await supabase
      .from('workbooks')
      .update({
        content: { pages: pagesRef.current },
        title: titleRef.current.trim() || 'دفتر بلا عنوان',
        subject: subjectRef.current.trim() || null,
      })
      .eq('id', workbook.id);
    // تجاهل نتيجة حفظ أقدم وصلت متأخرة بعد حفظ أحدث، وإلا قرّرت هي المؤشر.
    if (seq < lastAppliedSeq.current) return;
    lastAppliedSeq.current = seq;
    setSaveState(error ? 'error' : 'saved');
  }, [workbook.id]);

  // حفظ تلقائي بعد توقف الكتابة بثانية ونصف.
  const scheduleSave = useCallback(() => {
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void persist();
    }, 1500);
  }, [persist]);

  const editor = useEditor({
    extensions: editorExtensions,
    content: pages[0]?.doc ?? EMPTY_DOC,
    // مطلوب مع الـ App Router حتى لا يختلف أول رسم عن الخادم.
    immediatelyRender: false,
    editorProps: {
      attributes: { dir: 'rtl', spellcheck: 'false' },
    },
    onUpdate: ({ editor: ed }) => {
      if (switching.current) return;
      const doc = ed.getJSON() as Record<string, unknown>;
      setPages((prev) => {
        const next = [...prev];
        const idx = currentRef.current;
        if (!next[idx]) return prev;
        next[idx] = { ...next[idx], doc };
        return next;
      });
      scheduleSave();
    },
  });

  // احفظ ما لم يُحفظ بعد عند مغادرة الصفحة أو إغلاق التبويب.
  useEffect(() => {
    const flush = () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        void persist();
      }
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [persist]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  /**
   * يضع مستند صفحة في المحرر بلا إطلاق onUpdate، ثم **يصفّر سجل التراجع**.
   * بدون التصفير يبقى سجل واحد مشترك بين كل صفحات الدفتر، فيسحب Ctrl+Z محتوى
   * صفحة أخرى فوق الصفحة الحالية ويحفظه تلقائياً — فقدان بيانات صامت.
   */
  const applyDoc = useCallback(
    (doc: unknown) => {
      if (!editor) return;
      switching.current = true;
      editor.commands.setContent(doc as never, false);
      editor.view.updateState(
        EditorState.create({
          doc: editor.state.doc,
          plugins: editor.state.plugins,
        }),
      );
      switching.current = false;
    },
    [editor],
  );

  const goToPage = useCallback(
    (idx: number) => {
      if (!editor || idx < 0 || idx >= pagesRef.current.length || idx === currentRef.current) return;
      if (uploading) {
        setNotice('انتظر انتهاء رفع الصورة قبل تغيير الصفحة.');
        return;
      }
      setCurrent(idx);
      currentRef.current = idx;
      applyDoc(pagesRef.current[idx].doc);
    },
    [editor, applyDoc, uploading],
  );

  const addPage = useCallback(() => {
    if (pagesRef.current.length >= MAX_PAGES) {
      setNotice(`الحد الأقصى ${MAX_PAGES} صفحة في الدفتر الواحد.`);
      return;
    }
    if (uploading) {
      setNotice('انتظر انتهاء رفع الصورة أولاً.');
      return;
    }
    const page = newPage(`p${Date.now()}`);
    const nextPages = [...pagesRef.current, page];
    setPages(nextPages);
    pagesRef.current = nextPages;
    const idx = nextPages.length - 1;
    setCurrent(idx);
    currentRef.current = idx;
    applyDoc(page.doc);
    scheduleSave();
  }, [applyDoc, scheduleSave, uploading]);

  const deletePage = useCallback(() => {
    if (pagesRef.current.length <= 1) {
      setNotice('لا يمكن حذف الصفحة الوحيدة في الدفتر.');
      return;
    }
    if (!confirm(`حذف الصفحة ${currentRef.current + 1} نهائياً؟`)) return;
    const idx = currentRef.current;
    const nextPages = pagesRef.current.filter((_, i) => i !== idx);
    const nextIdx = Math.max(0, idx - 1);
    setPages(nextPages);
    pagesRef.current = nextPages;
    setCurrent(nextIdx);
    currentRef.current = nextIdx;
    applyDoc(nextPages[nextIdx].doc);
    scheduleSave();
  }, [applyDoc, scheduleSave]);

  const uploadImage = useCallback(
    async (file: File) => {
      if (!editor) return;
      setNotice(null);
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setNotice('الصيغ المدعومة: PNG و JPG و WEBP و GIF. حوّل الصورة لإحداها ثم أعد المحاولة.');
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setNotice('حجم الصورة أكبر من 10 ميجابايت.');
        return;
      }
      setUploading(true);
      try {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
        const path = `${workbook.user_id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('workbooks')
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from('workbooks').getPublicUrl(path);
        // التنقل بين الصفحات معطّل أثناء الرفع، فالصورة تُدرج حتماً في صفحتها.
        editor.chain().focus().setImage({ src: data.publicUrl }).run();
      } catch {
        setNotice('تعذّر رفع الصورة، حاول مرة ثانية.');
      } finally {
        setUploading(false);
        if (imageInput.current) imageInput.current.value = '';
      }
    },
    [editor, workbook.user_id],
  );

  const embedYoutube = useCallback(() => {
    if (!editor) return;
    const url = prompt('الصق رابط فيديو يوتيوب:');
    if (!url) return;
    const clean = url.trim();
    if (!/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(clean)) {
      setNotice('هذا ليس رابط يوتيوب صالحاً.');
      return;
    }
    editor.commands.setYoutubeVideo({ src: clean });
  }, [editor]);

  /** سؤال/جواب: نفس النوع يلغي التحديد، ونوع آخر يبدّله بدل أن يعشّش صندوقين. */
  const toggleQa = useCallback(
    (kind: 'question' | 'answer') => {
      if (!editor) return;
      if (editor.isActive('qaBlock', { kind })) {
        editor.chain().focus().lift('qaBlock').run();
      } else if (editor.isActive('qaBlock')) {
        editor.chain().focus().updateAttributes('qaBlock', { kind }).run();
      } else {
        editor.chain().focus().wrapIn('qaBlock', { kind }).run();
      }
    },
    [editor],
  );

  const exportPdf = useCallback(async () => {
    setExporting(true);
    setNotice(null);
    const allPages = pagesRef.current;
    let holder: HTMLDivElement | null = null;
    try {
      // حاوية تحمل ورقة واحدة في كل مرة: html2canvas ينسخ الشجرة كاملة عند كل
      // لقطة، فلو وُضعت الستون ورقة معاً صار العمل تربيعياً وتجمّد المتصفح.
      holder = document.createElement('div');
      holder.setAttribute('dir', 'rtl');
      holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fdfaf3';
      document.body.appendChild(holder);

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 6;
      const usableW = pageW - margin * 2;
      const usableH = pageH - margin * 2;

      for (let i = 0; i < allPages.length; i++) {
        setExportProgress(`${i + 1}/${allPages.length}`);
        // محتوى الطالب نفسه، لكن يمر عبر منقٍّ قبل الحقن على أي حال.
        const html = DOMPurify.sanitize(generateHTML(allPages[i].doc as never, workbookExtensions), {
          ADD_TAGS: ['iframe'],
          ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'data-youtube-video', 'data-kind'],
        });

        const sheet = document.createElement('div');
        sheet.className = `${styles.paper} ${styles.content}`;
        sheet.style.cssText = 'border-radius:0;box-shadow:none;min-height:1040px;width:794px';
        // صنف ProseMirror ضروري: تنسيقات العناوين والقوائم والاقتباس معلّقة
        // عليه في ملف الأنماط، وبدونه يخرج الـ PDF نصاً عادياً بلا تنسيق.
        sheet.innerHTML = `
          <div class="${styles.margin}"></div>
          <div class="${styles.watermark}">${Array.from({ length: 18 })
            .map(() => `<span>${escapeHtml(studentName)} · ${escapeHtml(studentEmail)}</span>`)
            .join('')}</div>
          <div style="position:relative;z-index:1"><div class="ProseMirror">${html}</div></div>
        `;
        // الـ iframe لا يُرسم في الـ PDF — استبدله بصندوق يحمل الرابط.
        sheet.querySelectorAll('div[data-youtube-video]').forEach((node) => {
          const src = node.querySelector('iframe')?.getAttribute('src') || '';
          const box = document.createElement('div');
          box.style.cssText =
            'border:1px dashed #b45309;border-radius:10px;padding:10px 12px;margin:8px 0;background:rgba(234,179,8,.12);font-size:13px;color:#7c2d12;word-break:break-all';
          box.textContent = `فيديو يوتيوب: ${youtubeWatchUrl(src)}`;
          node.replaceWith(box);
        });

        holder.appendChild(sheet);

        // انتظر تحميل الصور وإلا خرجت فارغة في الـ PDF.
        await Promise.all(
          Array.from(sheet.querySelectorAll('img')).map(
            (img) =>
              new Promise<void>((resolve) => {
                if (img.complete) return resolve();
                img.addEventListener('load', () => resolve(), { once: true });
                img.addEventListener('error', () => resolve(), { once: true });
              }),
          ),
        );

        // html2canvas لا يرسم repeating-linear-gradient، فتضيع سطور الدفتر من
        // الـ PDF. نرسمها عناصر حقيقية بعد أن يستقر ارتفاع الورقة.
        const ruled = document.createElement('div');
        ruled.style.cssText = 'position:absolute;inset:0;z-index:0;pointer-events:none';
        const lineCount = Math.ceil(sheet.scrollHeight / LINE_HEIGHT_PX);
        ruled.innerHTML = Array.from({ length: lineCount })
          .map(
            (_, k) =>
              `<div style="position:absolute;left:0;right:0;top:${(k + 1) * LINE_HEIGHT_PX}px;height:1px;background:#cfd8e3"></div>`,
          )
          .join('');
        sheet.insertBefore(ruled, sheet.firstChild);

        const canvas = await html2canvas(sheet, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#fdfaf3',
          logging: false,
        });
        const img = canvas.toDataURL('image/jpeg', 0.95);
        const imgH = (usableW * canvas.height) / canvas.width;

        if (i > 0) pdf.addPage();
        // ورقة الدفتر قد تتجاوز طول A4 — تُقسَّم على صفحات متتالية بإزاحة
        // مقدارها ارتفاع المساحة المفيدة بالضبط: بلا شريط مكرر ولا صفحة زائدة.
        let consumed = 0;
        let first = true;
        while (consumed < imgH - 1) {
          if (!first) pdf.addPage();
          pdf.addImage(img, 'JPEG', margin, margin - consumed, usableW, imgH);
          consumed += usableH;
          first = false;
        }

        sheet.remove();
      }

      const safeName = (titleRef.current || 'دفتر').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60);
      pdf.save(`${safeName}.pdf`);
    } catch {
      setNotice('تعذّر تصدير الـ PDF، حاول مرة ثانية.');
    } finally {
      holder?.remove();
      setExportProgress('');
      setExporting(false);
    }
  }, [studentEmail, studentName]);

  const watermarkCells = useMemo(() => Array.from({ length: 18 }, (_, i) => i), []);

  return (
    <div dir="rtl">
      {/* الشريط العلوي */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <Link
          href="/workbooks"
          className="inline-flex items-center gap-2 text-sm text-muted hover:opacity-80"
        >
          <ArrowRight className="w-4 h-4" />
          حقيبة الدفاتر
        </Link>
        <div className="flex items-center gap-2">
          <SaveBadge state={saveState} />
          <button
            onClick={exportPdf}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-white text-sm font-bold px-4 py-2 hover:opacity-90 disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? `جاري التصدير ${exportProgress}` : 'تصدير PDF'}
          </button>
        </div>
      </div>

      {/* اسم المادة والعنوان — يكتبهما الطالب بحرية */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-muted mb-1">عنوان الدفتر</label>
          <input
            value={title}
            onChange={(e) => { setTitle(e.target.value); scheduleSave(); }}
            placeholder="واجبات الفصل الأول"
            className="w-full rounded-xl bg-card/40 border border-dark-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">المادة</label>
          <input
            value={subject}
            onChange={(e) => { setSubject(e.target.value); scheduleSave(); }}
            placeholder="كيمياء"
            className="w-full rounded-xl bg-card/40 border border-dark-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      {notice && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-500">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {notice}
        </div>
      )}

      {/* شريط الأدوات */}
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-dark-border bg-card/40 p-2 mb-3">
        <ToolBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} label="عريض"><Bold className="w-4 h-4" /></ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} label="مائل"><Italic className="w-4 h-4" /></ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive('underline')} label="تحته خط"><UnderlineIcon className="w-4 h-4" /></ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })} label="عنوان"><Heading2 className="w-4 h-4" /></ToolBtn>
        <Sep />
        <ToolBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} label="قائمة"><List className="w-4 h-4" /></ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} label="قائمة مرقمة"><ListOrdered className="w-4 h-4" /></ToolBtn>
        <Sep />
        <ToolBtn onClick={() => toggleQa('question')} active={editor?.isActive('qaBlock', { kind: 'question' })} label="سؤال"><HelpCircle className="w-4 h-4" /></ToolBtn>
        <ToolBtn onClick={() => toggleQa('answer')} active={editor?.isActive('qaBlock', { kind: 'answer' })} label="جواب"><CheckCircle2 className="w-4 h-4" /></ToolBtn>
        <Sep />
        <div className="relative">
          <ToolBtn onClick={() => setColorOpen((v) => !v)} label="لون الخط"><Palette className="w-4 h-4" /></ToolBtn>
          {colorOpen && (
            <div className="absolute z-20 mt-1 flex gap-1 rounded-xl border border-dark-border bg-background p-2 shadow-xl">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => { editor?.chain().focus().setColor(c).run(); setColorOpen(false); }}
                  aria-label={`لون ${c}`}
                  className="h-6 w-6 rounded-full border border-white/20"
                  style={{ background: c }}
                />
              ))}
              <button
                onClick={() => { editor?.chain().focus().unsetColor().run(); setColorOpen(false); }}
                className="h-6 rounded-full border border-white/20 px-2 text-[11px] text-muted"
              >
                إزالة
              </button>
            </div>
          )}
        </div>
        <ToolBtn onClick={() => editor?.chain().focus().toggleHighlight({ color: '#fde68a' }).run()} active={editor?.isActive('highlight')} label="تظليل">
          <span className="text-xs font-bold">تظليل</span>
        </ToolBtn>
        <Sep />
        <input
          ref={imageInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadImage(f); }}
        />
        <ToolBtn onClick={() => imageInput.current?.click()} label="صورة" disabled={uploading}>
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
        </ToolBtn>
        <ToolBtn onClick={embedYoutube} label="فيديو يوتيوب"><YoutubeIcon className="w-4 h-4" /></ToolBtn>
        <Sep />
        <ToolBtn onClick={() => editor?.chain().focus().undo().run()} label="تراجع"><Undo2 className="w-4 h-4" /></ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().redo().run()} label="إعادة"><Redo2 className="w-4 h-4" /></ToolBtn>
      </div>

      {/* ورقة الدفتر */}
      <div className={styles.paper}>
        <div className={styles.lines} />
        <div className={styles.margin} />
        <div className={styles.watermark} aria-hidden="true">
          {watermarkCells.map((i) => (
            <span key={i}>{studentName} · {studentEmail}</span>
          ))}
        </div>
        <div className={styles.content}>
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* التنقل بين الصفحات */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => goToPage(current - 1)}
            disabled={current === 0}
            className="inline-flex items-center gap-1 rounded-xl border border-dark-border px-3 py-2 text-sm disabled:opacity-40 hover:border-primary"
          >
            <ChevronRight className="w-4 h-4" />
            السابق
          </button>
          <div className="flex items-center gap-1 max-w-[60vw] overflow-x-auto py-1">
            {pages.map((p, i) => (
              <button
                key={p.id}
                onClick={() => goToPage(i)}
                className={`h-8 min-w-8 shrink-0 rounded-lg px-2 text-sm font-bold transition ${
                  i === current
                    ? 'bg-primary text-white'
                    : 'border border-dark-border text-muted hover:border-primary'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <button
            onClick={() => goToPage(current + 1)}
            disabled={current >= pages.length - 1}
            className="inline-flex items-center gap-1 rounded-xl border border-dark-border px-3 py-2 text-sm disabled:opacity-40 hover:border-primary"
          >
            التالي
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted">صفحة {current + 1} من {pages.length}</span>
          <button
            onClick={addPage}
            className="inline-flex items-center gap-1 rounded-xl border border-dark-border px-3 py-2 text-sm hover:border-primary"
          >
            <Plus className="w-4 h-4" />
            صفحة جديدة
          </button>
          <button
            onClick={deletePage}
            className="inline-flex items-center gap-1 rounded-xl border border-red-500/40 text-red-400 px-3 py-2 text-sm hover:bg-red-500/10"
          >
            <Trash2 className="w-4 h-4" />
            حذف الصفحة
          </button>
        </div>
      </div>
    </div>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> جاري الحفظ
      </span>
    );
  }
  if (state === 'saved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
        <Check className="w-3.5 h-3.5" /> تم الحفظ
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-red-400">
        <AlertCircle className="w-3.5 h-3.5" /> تعذّر الحفظ
      </span>
    );
  }
  return null;
}

function ToolBtn({
  children,
  onClick,
  active,
  label,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      disabled={disabled}
      className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 transition disabled:opacity-40 ${
        active ? 'bg-primary text-white' : 'text-muted hover:bg-card/60 hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-1 h-5 w-px bg-dark-border" />;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** يحوّل رابط التضمين إلى رابط مشاهدة عادي ليعمل عند نسخه من الـ PDF. */
function youtubeWatchUrl(embedSrc: string): string {
  const m = embedSrc.match(/\/embed\/([A-Za-z0-9_-]{6,})/);
  return m ? `https://www.youtube.com/watch?v=${m[1]}` : embedSrc;
}
