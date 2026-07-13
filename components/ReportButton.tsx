'use client';

import { useState } from 'react';
import { Flag, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Kind = 'lecture' | 'book' | 'library_file';

interface Props {
  kind: Kind;
  itemId: string;
  /** Visual variant: 'icon' (just the flag) or 'pill' (icon + label). */
  variant?: 'icon' | 'pill';
  className?: string;
}

const REASON_LABELS: Record<string, string> = {
  copyright: 'انتهاك حقوق نشر',
  inappropriate: 'محتوى غير لائق',
  spam: 'سبام / إعلان',
  other: 'سبب آخر',
};

/**
 * Small "إبلاغ" button. Clicking opens a dialog where the user picks a
 * reason and optionally writes extra details. Submission goes through
 * /api/reports/submit which dedupes per (user, item).
 */
export function ReportButton({ kind, itemId, variant = 'icon', className = '' }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label="إبلاغ"
        className={
          className ||
          (variant === 'pill'
            ? 'inline-flex items-center gap-1.5 text-xs text-muted hover:text-error transition'
            : 'p-1.5 rounded-full hover:bg-error/10 transition')
        }
      >
        <Flag className="w-4 h-4" />
        {variant === 'pill' && <span>إبلاغ</span>}
      </button>
      {open && (
        <ReportDialog
          kind={kind}
          itemId={itemId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ReportDialog({
  kind,
  itemId,
  onClose,
}: {
  kind: Kind;
  itemId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('copyright');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const res = await fetch('/api/reports/submit', {
        method: 'POST',
        headers,
        body: JSON.stringify({ kind, item_id: itemId, reason, details }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'تعذّر إرسال البلاغ');
        return;
      }
      setDone(
        data.already_reported
          ? 'البلاغ موجود مسبقاً، وفريق الإدارة يراجعه.'
          : 'تم استلام بلاغك، شكراً. سيتم مراجعته في أقرب وقت.',
      );
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      dir="rtl"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-card border border-dark-border rounded-2xl p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Flag className="w-5 h-5 text-error" />
            الإبلاغ عن محتوى
          </h3>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="w-8 h-8 rounded-full hover:bg-primary/10 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <div className="text-sm text-success bg-success/10 border border-success/30 rounded-xl px-4 py-3 mb-4">
            {done}
          </div>
        ) : (
          <>
            <p className="text-sm text-muted mb-4">
              إذا رأيت محتوى ينتهك حقوق النشر أو غير لائق، بلّغنا وسنراجعه في
              أقرب وقت. كل البلاغات سرّية.
            </p>

            <label className="text-xs font-semibold block mb-2">سبب البلاغ</label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {Object.entries(REASON_LABELS).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => setReason(k)}
                  className={`text-sm rounded-xl border px-3 py-2 transition ${
                    reason === k
                      ? 'border-primary bg-primary/15 text-foreground'
                      : 'border-dark-border text-muted hover:border-primary/40'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            <label className="text-xs font-semibold block mb-2">
              تفاصيل إضافية (اختياري)
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="اشرح ما تشتكي منه، الكتاب الأصلي، رابط الصفحة الرسمية…"
              className="w-full rounded-xl bg-card/40 border border-dark-border px-3 py-2 text-sm outline-none focus:border-primary"
            />

            {error && (
              <p className="mt-3 text-sm text-error">{error}</p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="text-sm font-semibold px-4 py-2 rounded-xl border border-dark-border hover:border-muted/60 transition"
              >
                إلغاء
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                className="text-sm font-bold px-5 py-2 rounded-xl bg-error text-white hover:opacity-90 disabled:opacity-50 transition"
              >
                {submitting ? 'جاري الإرسال...' : 'إرسال البلاغ'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
