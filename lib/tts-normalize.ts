/**
 * Normalize assistant text before sending it to OpenAI TTS so the
 * synthesizer pronounces Arabic mixed with numbers/equations naturally.
 *
 * Strategy mirrors the Flutter side:
 *  - strip Markdown markers (**, ##, lists, code fences)
 *  - replace common LaTeX commands with Arabic spoken equivalents
 *  - convert "5/8" style fractions to "خمسة على ثمانية"
 *  - spell out small Western digits as Arabic words
 */

const ones = [
  'صفر', 'واحد', 'اثنان', 'ثلاثة', 'أربعة',
  'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة',
];
const teens = [
  'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر',
  'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر',
];
const tens = [
  '', '', 'عشرون', 'ثلاثون', 'أربعون',
  'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون',
];
const hundreds = [
  '', 'مئة', 'مئتان', 'ثلاثمئة', 'أربعمئة',
  'خمسمئة', 'ستمئة', 'سبعمئة', 'ثمانمئة', 'تسعمئة',
];

function intToArabicWords(n: number): string {
  if (n < 0) return `سالب ${intToArabicWords(-n)}`;
  if (n < 10) return ones[n];
  if (n < 20) return teens[n - 10];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const o = n % 10;
    return o === 0 ? tens[t] : `${ones[o]} و${tens[t]}`;
  }
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const r = n % 100;
    return r === 0 ? hundreds[h] : `${hundreds[h]} و${intToArabicWords(r)}`;
  }
  if (n < 10000) {
    const th = Math.floor(n / 1000);
    const r = n % 1000;
    let thW: string;
    if (th === 1) thW = 'ألف';
    else if (th === 2) thW = 'ألفان';
    else if (th < 11) thW = `${ones[th]} آلاف`;
    else thW = `${intToArabicWords(th)} ألف`;
    return r === 0 ? thW : `${thW} و${intToArabicWords(r)}`;
  }
  return String(n);
}

function stripMarkdown(s: string): string {
  s = s.replace(/```[a-zA-Z0-9_-]*\n?/g, '');
  s = s.replace(/```/g, '');
  s = s.replace(/`([^`]+)`/g, '$1');
  s = s.replace(/^#{1,6}\s+/gm, '');
  s = s.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1');
  s = s.replace(/_{1,3}([^_]+)_{1,3}/g, '$1');
  s = s.replace(/^\s*[-*+]\s+/gm, '');
  s = s.replace(/^\s*\d+\.\s+/gm, '');
  s = s.replace(/^\s*>\s?/gm, '');
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  return s;
}

function expandLatex(s: string): string {
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, ' $1 ');
  s = s.replace(/\$([^$\n]+?)\$/g, ' $1 ');
  s = s.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, ' $1 على $2 ');
  s = s.replace(/\\sqrt\{([^{}]+)\}/g, ' الجذر التربيعي لـ $1 ');
  const cmds: Record<string, string> = {
    '\\sum': ' مجموع ',
    '\\int': ' تكامل ',
    '\\pi': ' باي ',
    '\\alpha': ' ألفا ',
    '\\beta': ' بيتا ',
    '\\gamma': ' جاما ',
    '\\theta': ' ثيتا ',
    '\\delta': ' دلتا ',
    '\\lambda': ' لامبدا ',
    '\\mu': ' ميو ',
    '\\sigma': ' سيجما ',
    '\\omega': ' أوميجا ',
    '\\infty': ' ما لا نهاية ',
    '\\times': ' في ',
    '\\div': ' على ',
    '\\cdot': ' في ',
    '\\le': ' أصغر أو يساوي ',
    '\\leq': ' أصغر أو يساوي ',
    '\\ge': ' أكبر أو يساوي ',
    '\\geq': ' أكبر أو يساوي ',
    '\\neq': ' لا يساوي ',
    '\\approx': ' يقارب ',
    '\\rightarrow': ' يؤدي إلى ',
    '\\Rightarrow': ' إذن ',
  };
  for (const [k, v] of Object.entries(cmds)) {
    const re = new RegExp(k.replace(/\\/g, '\\\\'), 'g');
    s = s.replace(re, v);
  }
  s = s.replace(/\\[a-zA-Z]+\*?/g, ' ');
  s = s.replace(/[{}]/g, ' ');
  s = s.replace(/\^\{?(-?\d+)\}?/g, ' أس $1 ');
  s = s.replace(/_\{?([a-zA-Z0-9]+)\}?/g, ' $1 ');
  return s;
}

function expandFractionsAndOps(s: string): string {
  s = s.replace(/(\d+)\s*\/\s*(\d+)/g, '$1 على $2');
  s = s.replace(/×/g, ' في ');
  s = s.replace(/÷/g, ' على ');
  s = s.replace(/≈/g, ' يقارب ');
  s = s.replace(/≤/g, ' أصغر أو يساوي ');
  s = s.replace(/≥/g, ' أكبر أو يساوي ');
  s = s.replace(/≠/g, ' لا يساوي ');
  s = s.replace(/→/g, ' يؤدي إلى ');
  s = s.replace(/∞/g, ' ما لا نهاية ');
  return s;
}

function digitsToArabicWords(s: string): string {
  return s.replace(/\b(\d{1,4})\b/g, (m) => {
    const n = parseInt(m, 10);
    return Number.isFinite(n) ? intToArabicWords(n) : m;
  });
}

export function normalizeForTts(input: string): string {
  let s = input;
  s = stripMarkdown(s);
  s = expandLatex(s);
  s = expandFractionsAndOps(s);
  s = digitsToArabicWords(s);
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}
