'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Send, Loader2, Plus, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/providers/AuthProvider';

interface Channel {
  id: string;
  title: string;
  url: string;
  owner_type: string;
  owner_name: string | null;
  subject_id: string | null;
  description: string | null;
  approved: boolean;
}

export default function TelegramPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  // Member submission form.
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    // RLS returns only approved channels (plus the user's own pending ones).
    const { data } = await supabase
      .from('telegram_channels')
      .select('*')
      .order('sort_order', { ascending: true });
    setRows((data ?? []) as Channel[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    if (!user) {
      setFormError('سجّل دخولك أولاً لإضافة قناة.');
      return;
    }
    const t = title.trim();
    const u = url.trim();
    if (!t) {
      setFormError('أدخل اسم القناة.');
      return;
    }
    if (!/^https?:\/\/.+/i.test(u)) {
      setFormError('أدخل رابطاً صحيحاً يبدأ بـ http أو https.');
      return;
    }
    if (!acceptedTerms) {
      setFormError('يجب الموافقة على شروط الاستخدام.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('telegram_channels').insert({
        title: t.slice(0, 120),
        url: u,
        owner_type: 'teacher',
        owner_name: ownerName.trim() || null,
        submitted_by: user.id,
        approved: false,
      });
      if (error) throw error;
      setTitle('');
      setUrl('');
      setOwnerName('');
      setAcceptedTerms(false);
      setFormSuccess('تم إرسال القناة — ستظهر بعد موافقة الإدارة.');
      await load();
    } catch {
      setFormError('تعذّر إرسال القناة، حاول مرة ثانية.');
    } finally {
      setSubmitting(false);
    }
  };

  const approved = rows.filter((r) => r.approved);
  const myPending = rows.filter((r) => !r.approved);

  return (
    <main className="min-h-screen bg-background text-foreground" dir="rtl">
      <div className="max-w-4xl mx-auto px-5 py-10">
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 text-sm text-muted hover:opacity-80 mb-6"
        >
          <ArrowRight className="w-4 h-4" />
          العودة
        </Link>

        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">قنوات تليجرام</h1>
          <p className="text-muted">
            قنوات الأساتذة والمنصة على تليجرام. تقدر تضيف قناة وتظهر بعد موافقة الإدارة.
          </p>
        </header>

        {loading ? (
          <div className="py-10 text-center text-muted flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> جاري التحميل...
          </div>
        ) : (
          <div className="space-y-3 mb-10">
            {approved.length === 0 ? (
              <div className="py-8 text-center text-muted">لا توجد قنوات بعد.</div>
            ) : (
              approved.map((c) => <ChannelRow key={c.id} c={c} />)
            )}
            {myPending.map((c) => (
              <div key={c.id} className="opacity-70">
                <ChannelRow c={c} pending />
              </div>
            ))}
          </div>
        )}

        {/* Member submission */}
        <section className="card border border-dark-border rounded-2xl p-5">
          <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" /> أضف قناة
          </h2>
          <p className="text-sm text-muted mb-4">
            تُراجَع القناة من الإدارة قبل ظهورها للطلاب.
          </p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="اسم القناة"
              className="w-full rounded-xl bg-card/40 border border-dark-border px-4 py-2.5 text-sm outline-none focus:border-primary"
            />
            <input
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="اسم الأستاذ (اختياري)"
              className="w-full rounded-xl bg-card/40 border border-dark-border px-4 py-2.5 text-sm outline-none focus:border-primary"
            />
            <input
              dir="ltr"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://t.me/..."
              className="w-full rounded-xl bg-card/40 border border-dark-border px-4 py-2.5 text-sm outline-none focus:border-primary"
            />
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <span>
                أوافق على{' '}
                <Link href="/terms" className="text-primary hover:underline">
                  شروط الاستخدام
                </Link>
              </span>
            </label>
            <button
              type="submit"
              disabled={submitting || !acceptedTerms}
              className="rounded-xl bg-primary text-primary-foreground font-bold px-5 py-2.5 text-sm hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'جاري الإرسال...' : 'إرسال للمراجعة'}
            </button>
          </form>
          {formError && (
            <div className="mt-3 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
              {formError}
            </div>
          )}
          {formSuccess && (
            <div className="mt-3 text-sm text-emerald-500 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
              {formSuccess}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ChannelRow({ c, pending }: { c: Channel; pending?: boolean }) {
  return (
    <a
      href={pending ? undefined : c.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 card border border-dark-border rounded-2xl p-4 transition ${
        pending ? 'cursor-default' : 'hover:border-primary/40'
      }`}
    >
      <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
        <Send className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-bold truncate">{c.title}</h3>
        <p className="text-xs text-muted">
          {c.owner_type === 'platform' ? 'قناة المنصة' : c.owner_name || 'قناة أستاذ'}
        </p>
      </div>
      {pending ? (
        <span className="text-xs text-warning whitespace-nowrap">قيد المراجعة</span>
      ) : (
        <ExternalLink className="w-4 h-4 text-muted flex-shrink-0" />
      )}
    </a>
  );
}
