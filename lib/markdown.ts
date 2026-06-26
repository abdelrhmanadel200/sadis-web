import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Render Markdown + LaTeX to sanitized HTML.
 *
 * Pipeline:
 *   markdown → remark-gfm (tables/strikethrough) → remark-math (parse $...$, $$...$$)
 *            → mdast → hast → rehype-katex (math → KaTeX HTML) → stringify
 *            → DOMPurify (sanitize) → safe HTML
 *
 * This gives ChatGPT-style output: bold/italic/lists/code blocks AND crisp,
 * properly typeset equations from LaTeX (\frac, \sqrt, \pi, etc).
 */
export async function renderMarkdown(src: string): Promise<string> {
  const file = await remark()
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype)
    // @ts-expect-error rehype-katex options are accepted but typed as boolean here
    .use(rehypeKatex, { throwOnError: false, strict: 'ignore', output: 'html' })
    .use(rehypeStringify)
    .process(src);

  const dirty = String(file);
  // Allow KaTeX-generated markup (it uses many <span> elements with classes
  // and inline styles). DOMPurify defaults already permit those, but we
  // explicitly add `mathml` tags so display math renders correctly.
  return DOMPurify.sanitize(dirty, {
    ADD_TAGS: ['math', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'msqrt', 'annotation', 'semantics'],
    ADD_ATTR: ['style', 'class'],
  });
}
