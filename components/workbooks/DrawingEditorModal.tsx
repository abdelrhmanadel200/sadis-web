'use client';

import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import {
  X,
  Undo2,
  Trash2,
  Pencil,
  Minus,
  Square,
  Circle,
  Type,
  Eraser,
  ImagePlus,
  ImageOff,
  Loader2,
  Check,
} from 'lucide-react';
import { DEFAULT_H, DEFAULT_W, MAX_SHAPES, shapeToSvg, toReactProps, type Shape } from './drawing-shapes';

export interface DrawingValue {
  bg: string | null;
  width: number;
  height: number;
  shapes: Shape[];
}

type Tool = 'pen' | 'line' | 'rect' | 'ellipse' | 'text' | 'eraser';

const COLORS = ['#1a1a1a', '#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#ffffff'];
const WIDTHS = [2, 4, 8];
const round = (v: number) => Math.round(v * 10) / 10;

const TOOLS: { id: Tool; label: string; icon: React.ReactNode }[] = [
  { id: 'pen', label: 'قلم', icon: <Pencil className="w-4 h-4" /> },
  { id: 'line', label: 'خط', icon: <Minus className="w-4 h-4" /> },
  { id: 'rect', label: 'مربع', icon: <Square className="w-4 h-4" /> },
  { id: 'ellipse', label: 'دائرة', icon: <Circle className="w-4 h-4" /> },
  { id: 'text', label: 'نص', icon: <Type className="w-4 h-4" /> },
  { id: 'eraser', label: 'ممحاة', icon: <Eraser className="w-4 h-4" /> },
];

const HINT: Record<Tool, string> = {
  pen: 'ارسم بحرية بإصبعك أو بالماوس.',
  line: 'اسحب لرسم خط مستقيم.',
  rect: 'اسحب لرسم مربع أو مستطيل.',
  ellipse: 'اسحب لرسم دائرة.',
  text: 'اضغط مكان النص ثم اكتبه.',
  eraser: 'اضغط على أي شكل لحذفه.',
};

/** الرسم كما يظهر داخل الدفتر: صورة الخلفية ثم طبقة الأشكال فوقها. */
export function DrawingStatic({ value }: { value: DrawingValue }) {
  const W = value.width || DEFAULT_W;
  const H = value.height || DEFAULT_H;
  return (
    <div style={{ position: 'relative', width: '100%', paddingTop: `${(H / W) * 100}%`, background: '#ffffff' }}>
      {value.bg && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value.bg}
          alt=""
          draggable={false}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'fill', margin: 0, borderRadius: 0, maxWidth: 'none' }}
        />
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      >
        {value.shapes.map((s, i) => {
          const el = shapeToSvg(s);
          return createElement(el.tag, { key: i, ...toReactProps(el.attrs) }, el.text);
        })}
      </svg>
    </div>
  );
}

/**
 * محرر الرسم بملء الشاشة: قلم، خط، مربع، دائرة، نص، ممحاة، فوق لوحة بيضاء
 * أو فوق صورة. يعمل باللمس وبالماوس (Pointer Events).
 */
export default function DrawingEditorModal({
  initial,
  fitToBackground,
  onSave,
  onCancel,
  onPickBackground,
}: {
  initial: DrawingValue;
  /** عند فتح المحرر على صورة موجودة: اضبط الارتفاع على نسبة الصورة. */
  fitToBackground?: boolean;
  onSave: (v: DrawingValue) => void;
  onCancel: () => void;
  /** يرفع صورة خلفية ويعيد رابطها، أو null عند الفشل. */
  onPickBackground?: (file: File) => Promise<string | null>;
}) {
  const W = initial.width || DEFAULT_W;
  const [H, setH] = useState(initial.height || DEFAULT_H);
  const [shapes, setShapes] = useState<Shape[]>(initial.shapes);
  const [bg, setBg] = useState<string | null>(initial.bg);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(COLORS[1]);
  const [width, setWidth] = useState(4);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [bgBusy, setBgBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  // المرجع هو مصدر الحقيقة أثناء السحب: حدث الرفع قد يسبق إعادة الرسم.
  const draftRef = useRef<Shape | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const fitHeight = useCallback(
    (url: string) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          if (img.naturalWidth > 0) {
            setH(Math.min(1600, Math.max(120, Math.round((W * img.naturalHeight) / img.naturalWidth))));
          }
          resolve();
        };
        img.onerror = () => resolve();
        img.src = url;
      }),
    [W],
  );

  useEffect(() => {
    if (fitToBackground && initial.bg) void fitHeight(initial.bg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const setDraftBoth = (d: Shape | null) => {
    draftRef.current = d;
    setDraft(d);
  };

  const toLogical = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return {
      x: round(((e.clientX - r.left) * W) / r.width),
      y: round(((e.clientY - r.top) * H) / r.height),
    };
  };

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (tool === 'eraser') return;
    if (shapes.length >= MAX_SHAPES) {
      setErr('وصلت للحد الأقصى من الأشكال في هذا الرسم.');
      return;
    }
    const pt = toLogical(e);
    if (tool === 'text') {
      const text = window.prompt('اكتب النص:');
      if (text && text.trim()) {
        setShapes((s) => [...s, { t: 'text', c: color, s: 12 + width * 4, x: pt.x, y: pt.y, text: text.trim().slice(0, 200) }]);
      }
      return;
    }
    svgRef.current?.setPointerCapture(e.pointerId);
    startRef.current = pt;
    if (tool === 'pen') setDraftBoth({ t: 'pen', c: color, w: width, p: [pt.x, pt.y] });
    else if (tool === 'line') setDraftBoth({ t: 'line', c: color, w: width, x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
    else if (tool === 'rect') setDraftBoth({ t: 'rect', c: color, w: width, x: pt.x, y: pt.y, wd: 0, ht: 0 });
    else if (tool === 'ellipse') setDraftBoth({ t: 'ellipse', c: color, w: width, cx: pt.x, cy: pt.y, rx: 0, ry: 0 });
  };

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = draftRef.current;
    const s0 = startRef.current;
    if (!d || !s0) return;
    const pt = toLogical(e);
    switch (d.t) {
      case 'pen': {
        const lx = d.p[d.p.length - 2];
        const ly = d.p[d.p.length - 1];
        if (Math.hypot(pt.x - lx, pt.y - ly) < 1.5) return;
        setDraftBoth({ ...d, p: [...d.p, pt.x, pt.y] });
        break;
      }
      case 'line':
        setDraftBoth({ ...d, x2: pt.x, y2: pt.y });
        break;
      case 'rect':
        setDraftBoth({
          ...d,
          x: Math.min(s0.x, pt.x),
          y: Math.min(s0.y, pt.y),
          wd: round(Math.abs(pt.x - s0.x)),
          ht: round(Math.abs(pt.y - s0.y)),
        });
        break;
      case 'ellipse':
        setDraftBoth({
          ...d,
          cx: round((s0.x + pt.x) / 2),
          cy: round((s0.y + pt.y) / 2),
          rx: round(Math.abs(pt.x - s0.x) / 2),
          ry: round(Math.abs(pt.y - s0.y) / 2),
        });
        break;
    }
  };

  const onUp = () => {
    const d = draftRef.current;
    startRef.current = null;
    setDraftBoth(null);
    if (!d) return;
    const tiny =
      (d.t === 'line' && Math.hypot(d.x2 - d.x1, d.y2 - d.y1) < 2) ||
      (d.t === 'rect' && (d.wd < 2 || d.ht < 2)) ||
      (d.t === 'ellipse' && (d.rx < 1 || d.ry < 1));
    if (tiny) return;
    setShapes((s) => (s.length >= MAX_SHAPES ? s : [...s, d]));
  };

  const pickBg = async (file: File) => {
    if (!onPickBackground) return;
    setErr(null);
    setBgBusy(true);
    const url = await onPickBackground(file);
    setBgBusy(false);
    if (fileRef.current) fileRef.current.value = '';
    if (!url) {
      setErr('تعذّر رفع الصورة. الصيغ المدعومة PNG و JPG و WEBP و GIF بحد أقصى 10 ميجابايت.');
      return;
    }
    await fitHeight(url);
    setBg(url);
  };

  const cancel = () => {
    const dirty = shapes !== initial.shapes || bg !== initial.bg;
    if (dirty && !window.confirm('تجاهل التعديلات على الرسم؟')) return;
    onCancel();
  };

  const btn = (active: boolean) =>
    `inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-lg px-2.5 text-xs font-bold transition ${
      active ? 'bg-sky-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'
    }`;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/85" dir="rtl">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-neutral-900 p-2">
        {TOOLS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTool(t.id)} className={btn(tool === t.id)} title={t.label}>
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}

        <span className="mx-1 h-6 w-px bg-white/15" />

        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={`لون ${c}`}
            className={`h-7 w-7 rounded-full border-2 ${color === c ? 'border-sky-400 scale-110' : 'border-white/30'}`}
            style={{ background: c }}
          />
        ))}

        <span className="mx-1 h-6 w-px bg-white/15" />

        {WIDTHS.map((w) => (
          <button key={w} type="button" onClick={() => setWidth(w)} className={btn(width === w)} title="السُمك">
            <span className="rounded-full bg-current" style={{ width: w + 4, height: w + 4 }} />
          </button>
        ))}

        <span className="mx-1 h-6 w-px bg-white/15" />

        <button type="button" onClick={() => setShapes((s) => s.slice(0, -1))} className={btn(false)} title="تراجع">
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => shapes.length && window.confirm('مسح كل الرسم؟') && setShapes([])}
          className={btn(false)}
          title="مسح الكل"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {onPickBackground && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void pickBg(f);
              }}
            />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={bgBusy} className={btn(false)} title="صورة للرسم عليها">
              {bgBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
              <span className="hidden sm:inline">صورة</span>
            </button>
            {bg && (
              <button type="button" onClick={() => setBg(null)} className={btn(false)} title="إزالة الصورة">
                <ImageOff className="w-4 h-4" />
              </button>
            )}
          </>
        )}

        <div className="ms-auto flex items-center gap-2">
          <button type="button" onClick={cancel} className="inline-flex h-9 items-center gap-1 rounded-lg bg-white/10 px-3 text-sm font-bold text-white hover:bg-white/20">
            <X className="w-4 h-4" /> إلغاء
          </button>
          <button
            type="button"
            onClick={() => onSave({ bg, width: W, height: H, shapes })}
            className="inline-flex h-9 items-center gap-1 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-500"
          >
            <Check className="w-4 h-4" /> حفظ الرسم
          </button>
        </div>
      </div>

      {err && <div className="bg-red-600 px-3 py-2 text-sm text-white">{err}</div>}

      <div className="flex flex-1 items-start justify-center overflow-auto p-3 sm:p-6">
        <div className="w-full" style={{ maxWidth: `min(900px, calc((100vh - 160px) * ${W / H}))` }}>
          <div style={{ position: 'relative', width: '100%', paddingTop: `${(H / W) * 100}%`, background: '#ffffff', borderRadius: 12, overflow: 'hidden' }}>
            {bg && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bg}
                alt=""
                draggable={false}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'fill', userSelect: 'none', pointerEvents: 'none' }}
              />
            )}
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                touchAction: 'none',
                cursor: tool === 'eraser' ? 'default' : 'crosshair',
              }}
            >
              {shapes.map((s, i) => {
                const el = shapeToSvg(s);
                const props = toReactProps(el.attrs);
                if (tool !== 'eraser') return createElement(el.tag, { key: i, ...props }, el.text);
                return (
                  <g
                    key={i}
                    style={{ cursor: 'pointer' }}
                    onPointerDown={(ev) => {
                      ev.stopPropagation();
                      setShapes((arr) => arr.filter((_, j) => j !== i));
                    }}
                  >
                    {createElement(el.tag, props, el.text)}
                    {el.tag !== 'text' &&
                      createElement(el.tag, { ...props, stroke: 'rgba(0,0,0,0)', strokeWidth: '22', fill: 'none', pointerEvents: 'stroke' })}
                  </g>
                );
              })}
              {draft &&
                (() => {
                  const el = shapeToSvg(draft);
                  return createElement(el.tag, toReactProps(el.attrs), el.text);
                })()}
            </svg>
          </div>
          <p className="mt-2 text-center text-xs text-white/60">{HINT[tool]}</p>
        </div>
      </div>
    </div>
  );
}
