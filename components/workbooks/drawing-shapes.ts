// أشكال الرسم داخل الدفتر: قلم حر، خط، مستطيل، دائرة، نص.
// الإحداثيات منطقية بمقاس اللوحة (width × height) لا بكسلات الشاشة، فيظهر
// الرسم بنفس الشكل على أي شاشة وفي ملف الـ PDF المصدَّر.

export type Shape =
  | { t: 'pen'; c: string; w: number; p: number[] }
  | { t: 'line'; c: string; w: number; x1: number; y1: number; x2: number; y2: number }
  | { t: 'rect'; c: string; w: number; x: number; y: number; wd: number; ht: number }
  | { t: 'ellipse'; c: string; w: number; cx: number; cy: number; rx: number; ry: number }
  | { t: 'text'; c: string; s: number; x: number; y: number; text: string };

export const DEFAULT_W = 720;
export const DEFAULT_H = 405;
export const MAX_SHAPES = 800;

const COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;

const clamp = (v: unknown, lo: number, hi: number, d: number) => {
  const x = typeof v === 'number' && Number.isFinite(v) ? v : d;
  return Math.min(hi, Math.max(lo, x));
};
const color = (v: unknown) => (typeof v === 'string' && COLOR_RE.test(v) ? v : '#1a1a1a');

/**
 * يتحقق من أشكال قادمة من قاعدة البيانات أو من الحافظة: أنواع معروفة فقط،
 * أرقام محدودة، ألوان hex فقط، ونص قصير. لا شيء منها يصل للـ DOM كـ HTML.
 */
export function sanitizeShapes(raw: unknown): Shape[] {
  if (!Array.isArray(raw)) return [];
  const out: Shape[] = [];
  for (const item of raw.slice(0, MAX_SHAPES)) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const c = color(o.c);
    const w = clamp(o.w, 1, 40, 4);
    const P = (v: unknown) => clamp(v, -5000, 5000, 0);
    const S = (v: unknown) => clamp(v, 0, 10000, 0);
    switch (o.t) {
      case 'pen': {
        const p = Array.isArray(o.p) ? (o.p as unknown[]).slice(0, 8000).map(P) : [];
        const even = p.length % 2 ? p.slice(0, -1) : p;
        if (even.length >= 2) out.push({ t: 'pen', c, w, p: even });
        break;
      }
      case 'line':
        out.push({ t: 'line', c, w, x1: P(o.x1), y1: P(o.y1), x2: P(o.x2), y2: P(o.y2) });
        break;
      case 'rect':
        out.push({ t: 'rect', c, w, x: P(o.x), y: P(o.y), wd: S(o.wd), ht: S(o.ht) });
        break;
      case 'ellipse':
        out.push({ t: 'ellipse', c, w, cx: P(o.cx), cy: P(o.cy), rx: S(o.rx), ry: S(o.ry) });
        break;
      case 'text': {
        const text = typeof o.text === 'string' ? o.text.slice(0, 200) : '';
        if (text.trim()) out.push({ t: 'text', c, s: clamp(o.s, 10, 96, 28), x: P(o.x), y: P(o.y), text });
        break;
      }
    }
  }
  return out;
}

function penPath(p: number[]): string {
  if (p.length < 2) return '';
  let d = `M${p[0]} ${p[1]}`;
  // نقطة واحدة (نقرة) تُرسم كنقطة صغيرة بدل أن تختفي.
  if (p.length === 2) return `${d} L${p[0] + 0.1} ${p[1]}`;
  for (let i = 2; i < p.length; i += 2) d += ` L${p[i]} ${p[i + 1]}`;
  return d;
}

export interface SvgEl {
  tag: 'path' | 'line' | 'rect' | 'ellipse' | 'text';
  attrs: Record<string, string>;
  text?: string;
}

/** وصف عنصر SVG لشكل واحد، يستعمله العرض الحي والتصدير معاً. */
export function shapeToSvg(s: Shape): SvgEl {
  if (s.t === 'text') {
    return {
      tag: 'text',
      attrs: {
        x: String(s.x),
        y: String(s.y),
        fill: s.c,
        'font-size': String(s.s),
        'font-weight': '700',
        'font-family': 'Tajawal, Cairo, Arial, sans-serif',
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
      },
      text: s.text,
    };
  }
  const stroke = {
    fill: 'none',
    stroke: s.c,
    'stroke-width': String(s.w),
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  };
  switch (s.t) {
    case 'pen':
      return { tag: 'path', attrs: { ...stroke, d: penPath(s.p) } };
    case 'line':
      return { tag: 'line', attrs: { ...stroke, x1: String(s.x1), y1: String(s.y1), x2: String(s.x2), y2: String(s.y2) } };
    case 'rect':
      return { tag: 'rect', attrs: { ...stroke, x: String(s.x), y: String(s.y), width: String(s.wd), height: String(s.ht), rx: '4' } };
    case 'ellipse':
    default:
      return { tag: 'ellipse', attrs: { ...stroke, cx: String(s.cx), cy: String(s.cy), rx: String(s.rx), ry: String(s.ry) } };
  }
}

/** stroke-width → strokeWidth لخصائص React. */
export function toReactProps(attrs: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(attrs)) {
    out[k.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase())] = v;
  }
  return out;
}
