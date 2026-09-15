'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { PenTool } from 'lucide-react';
import { DEFAULT_H, DEFAULT_W, sanitizeShapes, shapeToSvg } from './drawing-shapes';
import DrawingEditorModal, { DrawingStatic, type DrawingValue } from './DrawingEditorModal';

// روابط الخلفية تأتي من مخزن الدفاتر العام فقط (https)؛ أي شيء آخر يُهمل.
const safeBg = (v: unknown): string | null => (typeof v === 'string' && /^https:\/\//i.test(v) ? v : null);
const dim = (v: unknown, d: number) => {
  const x = Number(v);
  return Number.isFinite(x) && x >= 50 && x <= 4000 ? Math.round(x) : d;
};

/**
 * كتلة رسم داخل الدفتر: صورة خلفية اختيارية + أشكال فوقها. تُحفظ الأشكال
 * JSON داخل محتوى الصفحة، وتُولَّد HTML ثابتاً (صورة + SVG) للتصدير PDF.
 * وسوم SVG بلا مساحة أسماء: HTML الناتج يُحلَّل بالمتصفح فيأخذها تلقائياً.
 */
export const Drawing = Node.create({
  name: 'drawing',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      bg: {
        default: null,
        rendered: false,
        parseHTML: (el: HTMLElement) => safeBg(el.getAttribute('data-bg')),
      },
      width: {
        default: DEFAULT_W,
        rendered: false,
        parseHTML: (el: HTMLElement) => dim(el.getAttribute('data-width'), DEFAULT_W),
      },
      height: {
        default: DEFAULT_H,
        rendered: false,
        parseHTML: (el: HTMLElement) => dim(el.getAttribute('data-height'), DEFAULT_H),
      },
      shapes: {
        default: [],
        rendered: false,
        parseHTML: (el: HTMLElement) => {
          try {
            return sanitizeShapes(JSON.parse(el.getAttribute('data-shapes') || '[]'));
          } catch {
            return [];
          }
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-drawing]' }];
  },

  renderHTML({ node }) {
    const W = dim(node.attrs.width, DEFAULT_W);
    const H = dim(node.attrs.height, DEFAULT_H);
    const bg = safeBg(node.attrs.bg);
    const shapes = sanitizeShapes(node.attrs.shapes);

    const svgChildren = shapes.map((s) => {
      const el = shapeToSvg(s);
      return el.text !== undefined ? [el.tag, el.attrs, el.text] : [el.tag, el.attrs];
    });
    const layers: unknown[] = [];
    if (bg) {
      layers.push([
        'img',
        {
          src: bg,
          alt: '',
          style: 'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:fill;margin:0;border-radius:0;max-width:none',
        },
      ]);
    }
    layers.push([
      'svg',
      {
        viewBox: `0 0 ${W} ${H}`,
        preserveAspectRatio: 'none',
        style: 'position:absolute;top:0;left:0;width:100%;height:100%',
      },
      ...svgChildren,
    ]);

    return [
      'div',
      {
        'data-drawing': 'true',
        'data-bg': bg ?? '',
        'data-width': String(W),
        'data-height': String(H),
        'data-shapes': JSON.stringify(shapes),
        class: 'wb-drawing',
        style: `position:relative;width:100%;padding-top:${((H / W) * 100).toFixed(4)}%;background:#ffffff`,
      },
      ...layers,
    ] as never;
  },
});

function DrawingView({ node, updateAttributes, selected }: NodeViewProps) {
  const [editing, setEditing] = useState(false);
  const value: DrawingValue = {
    bg: safeBg(node.attrs.bg),
    width: dim(node.attrs.width, DEFAULT_W),
    height: dim(node.attrs.height, DEFAULT_H),
    shapes: sanitizeShapes(node.attrs.shapes),
  };

  return (
    <NodeViewWrapper className="my-2" data-drag-handle="">
      <div
        contentEditable={false}
        className={`relative overflow-hidden rounded-xl border-2 ${selected ? 'border-sky-500' : 'border-transparent'}`}
        style={{ lineHeight: 'normal' }}
      >
        <DrawingStatic value={value} />
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-lg bg-black/70 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-black/85"
        >
          <PenTool className="h-3.5 w-3.5" /> تعديل الرسم
        </button>
      </div>
      {editing &&
        typeof document !== 'undefined' &&
        createPortal(
          <DrawingEditorModal
            initial={value}
            onCancel={() => setEditing(false)}
            onSave={(v) => {
              updateAttributes(v);
              setEditing(false);
            }}
          />,
          document.body,
        )}
    </NodeViewWrapper>
  );
}

/** نسخة المحرر الحي: نفس الكتلة مع واجهة React وزر "تعديل الرسم". */
export const DrawingWithView = Drawing.extend({
  addNodeView() {
    return ReactNodeViewRenderer(DrawingView);
  },
});
