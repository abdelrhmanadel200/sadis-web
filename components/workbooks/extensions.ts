import { Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';

/**
 * كتلة "سؤال" أو "جواب" — الطالب يحدد بها أسئلته وأجوبته داخل الدفتر،
 * فتظهر بإطار ولون مميز وتبقى محفوظة في JSON وتُصدَّر مع الـ PDF.
 */
export const QaBlock = Node.create({
  name: 'qaBlock',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      kind: {
        default: 'question',
        parseHTML: (el) => el.getAttribute('data-kind') || 'question',
        renderHTML: (attrs) => ({ 'data-kind': attrs.kind }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-kind]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const kind = HTMLAttributes['data-kind'] === 'answer' ? 'answer' : 'question';
    return [
      'div',
      mergeAttributes(HTMLAttributes, { class: `wb-qa wb-qa-${kind}` }),
      0,
    ];
  },
});

/**
 * الامتدادات المشتركة بين المحرر وبين توليد HTML وقت التصدير — لا بد أن
 * تكون القائمة واحدة، وإلا خرج الـ PDF ناقصاً عن الشاشة.
 */
export const workbookExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
  }),
  Underline,
  TextStyle,
  Color,
  Highlight.configure({ multicolor: true }),
  Image.configure({ inline: false, allowBase64: false }),
  Youtube.configure({
    controls: true,
    nocookie: true,
    width: 560,
    height: 315,
  }),
  QaBlock,
];

/** امتدادات المحرر الحي = المشتركة + نص إرشادي (لا معنى له عند التصدير). */
export const editorExtensions = [
  ...workbookExtensions,
  Placeholder.configure({
    placeholder: 'اكتب سؤالك أو ملاحظتك هنا...',
  }),
];

export interface WorkbookPage {
  id: string;
  /** مستند TipTap لهذه الصفحة */
  doc: Record<string, unknown>;
}

export const EMPTY_DOC: Record<string, unknown> = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

export function newPage(id: string): WorkbookPage {
  return { id, doc: { ...EMPTY_DOC } };
}
