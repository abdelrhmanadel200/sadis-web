'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Plus,
  Trash2,
  Loader2,
  ImagePlus,
  Pencil,
  Save,
  X,
  Undo2,
  ZoomIn,
  ZoomOut,
  Hand,
  Maximize2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/providers/AuthProvider';

/** خط رسم فوق الصورة — إحداثيات نسبية (0..1) لتظهر صحيحة على أي شاشة. */
interface Stroke {
  color: string;
  width: number;
  points: { x: number; y: number }[];
}

interface Draft {
  id: string;
  title: string | null;
  body: string | null;
  image_path: string | null;
  annotations: Stroke[] | null;
  updated_at: string;
}

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#111827'];

export default function DraftsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('drafts')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    const rows = (data ?? []) as Draft[];
    setDrafts(rows);

    // روابط موقّتة لعرض الصور (bucket خاص).
    const map: Record<string, string> = {};
    await Promise.all(
      rows
        .filter((d) => d.image_path)
        .map(async (d) => {
          const { data: signed } = await supabase.storage
            .from('drafts')
            .createSignedUrl(d.image_path as string, 60 * 60);
          if (signed?.signedUrl) map[d.id] = signed.signedUrl;
        }),
    );
    setUrls(map);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const createDraft = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('drafts')
      .insert({ user_id: user.id, title: 'مسودة جديدة', body: '' })
      .select('*')
      .single();
    if (data) {
      await load();
      setEditing(data as Draft);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('حذف المسودة نهائياً؟')) return;
    await supabase.from('drafts').delete().eq('id', id);
    setDrafts((p) => p.filter((d) => d.id !== id));
  };

  return (
    <main className="min-h-screen bg-background text-foreground" dir="rtl">
      <div className="max-w-4xl mx-auto px-5 py-10">
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 text-sm text-muted hover:opacity-80 mb-6"
        >
          <ArrowRight className="w-4 h-4" /> العودة
        </Link>

        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">المسودة</h1>
            <p className="text-muted">
              ملاحظاتك وصورك — تُحفظ تلقائياً وتظهر في التطبيق والموقع معاً.
            </p>
          </div>
          <button
            onClick={createDraft}
            className="rounded-xl bg-primary text-primary-foreground font-bold px-5 py-2.5 text-sm hover:opacity-90 inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> مسودة جديدة
          </button>
        </header>

        {loading ? (
          <div className="py-10 text-center text-muted flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> جاري التحميل...
          </div>
        ) : drafts.length === 0 ? (
          <div className="py-16 text-center text-muted">
            لا توجد مسودات بعد — اضغط «مسودة جديدة» لتبدأ.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {drafts.map((d) => (
              <div
                key={d.id}
                className="card border border-dark-border rounded-2xl p-4 flex flex-col"
              >
                {urls[d.id] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={urls[d.id]}
                    alt=""
                    className="w-full h-36 object-cover rounded-xl mb-3"
                  />
                )}
                <h3 className="font-bold mb-1">{d.title || 'بدون عنوان'}</h3>
                <p className="text-sm text-muted line-clamp-2 flex-1">{d.body || '—'}</p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-dark-border">
                  <span className="text-xs text-muted">
                    {new Date(d.updated_at).toLocaleDateString('ar-IQ')}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditing(d)}
                      className="p-2 rounded-lg hover:bg-primary/10 text-primary"
                      title="تحرير"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => remove(d.id)}
                      className="p-2 rounded-lg hover:bg-destructive/10 text-destructive"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <DraftEditor
          draft={editing}
          signedUrl={urls[editing.id]}
          onClose={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </main>
  );
}

function DraftEditor({
  draft,
  signedUrl,
  onClose,
}: {
  draft: Draft;
  signedUrl?: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState(draft.title ?? '');
  const [body, setBody] = useState(draft.body ?? '');
  const [imgUrl, setImgUrl] = useState<string | undefined>(signedUrl);
  const [imagePath, setImagePath] = useState<string | null>(draft.image_path);
  const [strokes, setStrokes] = useState<Stroke[]>(draft.annotations ?? []);
  const [color, setColor] = useState(COLORS[0]);
  const [drawing, setDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  // إعادة الرسم أثناء السحب (الخط الجاري محفوظ في ref لتفادي إعادة إنشاء المصفوفة).
  const [, forceRedraw] = useState(0);
  // التكبير والتحريك: الطالب يحتاج تقريب الصورة ليؤشّر بدقة.
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [mode, setMode] = useState<'draw' | 'pan'>('draw');
  const panStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const current = useRef<Stroke | null>(null);

  const save = async () => {
    setSaving(true);
    await supabase
      .from('drafts')
      .update({
        title: title.trim() || 'بدون عنوان',
        body,
        image_path: imagePath,
        annotations: strokes,
      })
      .eq('id', draft.id);
    setSaving(false);
    onClose();
  };

  const upload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('drafts')
      .upload(path, file, { contentType: file.type });
    if (!error) {
      setImagePath(path);
      setStrokes([]);
      const { data } = await supabase.storage.from('drafts').createSignedUrl(path, 60 * 60);
      setImgUrl(data?.signedUrl);
    }
    setUploading(false);
  };

  // إحداثيات نسبية حتى تظهر الرسوم صحيحة على أي حجم شاشة.
  // إحداثيات نسبية للصورة نفسها بعد التكبير/التحريك، حتى تبقى الخطوط
  // مثبّتة على مكانها الصحيح مهما غيّر الطالب التقريب.
  const rel = (e: React.PointerEvent) => {
    const r = wrapRef.current!.getBoundingClientRect();
    const x = (e.clientX - r.left - pan.x) / (r.width * zoom);
    const y = (e.clientY - r.top - pan.y) / (r.height * zoom);
    return { x, y };
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      dir="rtl"
    >
      <div className="w-full max-w-2xl bg-card rounded-2xl border border-dark-border my-8">
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border">
          <h3 className="font-bold">تحرير المسودة</h3>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-primary/10 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="عنوان المسودة"
            className="w-full rounded-xl border border-dark-border bg-card/40 px-4 py-2.5 text-sm outline-none focus:border-primary font-bold"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="اكتب ملاحظاتك هنا..."
            className="w-full min-h-[120px] rounded-xl border border-dark-border bg-card/40 px-4 py-2.5 text-sm outline-none focus:border-primary leading-relaxed"
          />

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = '';
            }}
          />

          {!imgUrl ? (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full rounded-xl border border-dashed border-primary/40 py-6 text-sm text-muted hover:border-primary inline-flex items-center justify-center gap-2"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ImagePlus className="w-4 h-4" />
              )}
              {uploading ? 'جاري الرفع...' : 'أضف صورة (يمكنك التأشير عليها)'}
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted">لون القلم:</span>
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full border-2 ${
                      color === c ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label="لون"
                  />
                ))}
                <button
                  onClick={() => setStrokes((s) => s.slice(0, -1))}
                  disabled={strokes.length === 0}
                  className="ms-auto text-xs inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dark-border disabled:opacity-40"
                >
                  <Undo2 className="w-3.5 h-3.5" /> تراجع
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-dark-border"
                >
                  تغيير الصورة
                </button>
              </div>

              {/* أدوات التقريب — يحتاجها الطالب ليؤشّر بدقة على التفاصيل */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-dark-border overflow-hidden">
                  <button
                    onClick={() => setMode('draw')}
                    className={`px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1 ${
                      mode === 'draw' ? 'bg-primary text-white' : 'text-muted'
                    }`}
                  >
                    <Pencil className="w-3.5 h-3.5" /> قلم
                  </button>
                  <button
                    onClick={() => setMode('pan')}
                    className={`px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1 ${
                      mode === 'pan' ? 'bg-primary text-white' : 'text-muted'
                    }`}
                  >
                    <Hand className="w-3.5 h-3.5" /> تحريك
                  </button>
                </div>
                <button
                  onClick={() => setZoom((z) => Math.min(5, +(z + 0.5).toFixed(2)))}
                  className="p-1.5 rounded-lg border border-dark-border"
                  title="تكبير"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    setZoom((z) => {
                      const next = Math.max(1, +(z - 0.5).toFixed(2));
                      if (next === 1) setPan({ x: 0, y: 0 });
                      return next;
                    })
                  }
                  className="p-1.5 rounded-lg border border-dark-border"
                  title="تصغير"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                  className="p-1.5 rounded-lg border border-dark-border"
                  title="إعادة الضبط"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                <span className="text-xs text-muted">{Math.round(zoom * 100)}%</span>
              </div>

              <div
                ref={wrapRef}
                className="relative select-none touch-none rounded-xl overflow-hidden border border-dark-border"
                onWheel={(e) => {
                  if (!e.ctrlKey) return; // Ctrl+عجلة = تقريب (سلوك مألوف)
                  e.preventDefault();
                  setZoom((z) => Math.min(5, Math.max(1, +(z - e.deltaY / 500).toFixed(2))));
                }}
                onPointerDown={(e) => {
                  (e.target as HTMLElement).setPointerCapture(e.pointerId);
                  if (mode === 'pan') {
                    panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
                    return;
                  }
                  current.current = { color, width: 3, points: [rel(e)] };
                  setDrawing(true);
                }}
                onPointerMove={(e) => {
                  if (mode === 'pan') {
                    if (!panStart.current) return;
                    const st = panStart.current;
                    setPan({ x: st.px + (e.clientX - st.x), y: st.py + (e.clientY - st.y) });
                    return;
                  }
                  if (!drawing || !current.current) return;
                  current.current.points.push(rel(e));
                  forceRedraw((n) => n + 1);
                }}
                onPointerUp={() => {
                  if (mode === 'pan') { panStart.current = null; return; }
                  if (current.current && current.current.points.length > 1) {
                    const done = current.current;
                    setStrokes((s) => [...s, done]);
                  }
                  current.current = null;
                  setDrawing(false);
                }}
              >
                <div
                  className="relative"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'top right',
                  }}
                >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgUrl} alt="" className="w-full block pointer-events-none" />
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox="0 0 1 1"
                  preserveAspectRatio="none"
                >
                  {[...strokes, ...(current.current ? [current.current] : [])].map((s, i) => (
                    <polyline
                      key={i}
                      points={s.points.map((p) => `${p.x},${p.y}`).join(' ')}
                      fill="none"
                      stroke={s.color}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                      style={{ strokeWidth: s.width }}
                    />
                  ))}
                </svg>
                </div>
              </div>
              <p className="text-xs text-muted">
                أشّر بإصبعك أو الماوس فوق الصورة. للتقريب استخدم زر التكبير، ثم
                «تحريك» لتنقل الصورة — تقدر تتراجع في أي وقت.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-dark-border">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-dark-border text-sm"
          >
            إلغاء
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-sm inline-flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            حفظ
          </button>
        </div>
      </div>
    </div>
  );
}
