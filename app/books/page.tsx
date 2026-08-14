'use client';

import PlatformGate from '@/components/PlatformGate';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Heart,
  ArrowRight,
  Search,
  ExternalLink,
  BookOpen,
  FileText,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/providers/AuthProvider';
import { fetchSavedIds, toggleSave } from '@/lib/saved-items';
import { DEFAULT_SUBJECTS } from '@/lib/subjects';
import { ReportButton } from '@/components/ReportButton';

interface Book {
  id: string;
  subject_id: string | null;
  title: string;
  description: string | null;
  author: string | null;
  external_url: string;
  cover_url: string | null;
  format: string | null;
  category: string | null;
  sort_order: number;
}

// فروع قسم الكتب (تطابق admin books page + عمود books.category)
const CATEGORIES = [
  { id: 'curriculum', label: 'كتب منهجية' },
  { id: 'booklet', label: 'ملازم' },
  { id: 'summary', label: 'ملخصات' },
  { id: 'exams', label: 'أسئلة وزارية' },
];

function BooksPageInner() {
  const { user } = useAuth();
  const router = useRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [categoryTab, setCategoryTab] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: rows }, savedSet] = await Promise.all([
        supabase.from('books').select('*').order('sort_order', { ascending: true }),
        fetchSavedIds(supabase, user?.id, 'book'),
      ]);
      if (cancelled) return;
      setBooks((rows ?? []) as Book[]);
      setSaved(savedSet);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleToggleSave = useCallback(
    async (bookId: string) => {
      if (!user) {
        router.push('/login');
        return;
      }
      const wasSaved = saved.has(bookId);
      setSaved((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.delete(bookId);
        else next.add(bookId);
        return next;
      });
      await toggleSave(supabase, user.id, 'book', bookId, wasSaved);
    },
    [user, saved, router],
  );

  const visible = books.filter((b) => {
    // الكتب القديمة بدون فرع تُعامل كـ"كتب منهجية".
    if (categoryTab !== 'all' && (b.category ?? 'curriculum') !== categoryTab) return false;
    if (subjectFilter !== 'all' && b.subject_id !== subjectFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${b.title} ${b.author ?? ''} ${b.description ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <main className="min-h-screen bg-background text-foreground" dir="rtl">
      <div className="max-w-6xl mx-auto px-5 py-10">
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 text-sm text-muted hover:opacity-80 mb-6"
        >
          <ArrowRight className="w-4 h-4" />
          العودة
        </Link>

        <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">الكتب والملخصات</h1>
            <p className="text-muted">
              كتب وملخصات خارجية — اضغط على القلب لحفظها في مكتبتك.
            </p>
          </div>
          <Link
            href="/library"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary-light hover:opacity-80"
          >
            مكتبتي المحفوظة
            <ArrowRight className="w-4 h-4 rotate-180" />
          </Link>
        </header>

        {/* تبويبات الفروع */}
        <div className="flex flex-wrap gap-2 mb-5 border-b border-dark-border pb-3">
          {[{ id: 'all', label: 'الكل' }, ...CATEGORIES].map((c) => {
            const count =
              c.id === 'all'
                ? books.length
                : books.filter((b) => (b.category ?? 'curriculum') === c.id).length;
            return (
              <button
                key={c.id}
                onClick={() => setCategoryTab(c.id)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
                  categoryTab === c.id
                    ? 'bg-primary text-white'
                    : 'bg-card/40 text-muted hover:text-foreground'
                }`}
              >
                {c.label}
                <span className="text-xs opacity-70"> ({count})</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث في الكتب..."
              className="w-full rounded-xl bg-card/40 border border-dark-border ps-9 pe-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              label="الكل"
              active={subjectFilter === 'all'}
              onClick={() => setSubjectFilter('all')}
            />
            {DEFAULT_SUBJECTS.map((s) => (
              <FilterChip
                key={s.id}
                label={s.name_ar}
                active={subjectFilter === s.id}
                onClick={() => setSubjectFilter(s.id)}
              />
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-muted">جاري التحميل...</div>
        ) : visible.length === 0 ? (
          <div className="py-10 text-center text-muted">
            لا توجد كتب في هذا القسم الآن.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {visible.map((b) => (
              <BookCard
                key={b.id}
                book={b}
                isSaved={saved.has(b.id)}
                onToggleSave={() => handleToggleSave(b.id)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
        active
          ? 'bg-primary text-white border-primary'
          : 'border-dark-border text-muted hover:border-primary/40'
      }`}
    >
      {label}
    </button>
  );
}

function BookCard({
  book,
  isSaved,
  onToggleSave,
}: {
  book: Book;
  isSaved: boolean;
  onToggleSave: () => void;
}) {
  const Icon = book.format === 'video' ? BookOpen : FileText;
  return (
    <div className="card border border-dark-border rounded-2xl overflow-hidden flex flex-col group">
      <a
        href={book.external_url}
        target="_blank"
        rel="noopener noreferrer"
        className="relative aspect-[3/4] bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center"
      >
        {book.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={book.cover_url}
            alt={book.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <Icon className="w-12 h-12 text-primary-light/70" />
        )}
        <div className="absolute top-2 start-2 flex items-center gap-1 text-[10px] bg-black/60 text-white px-2 py-1 rounded-full">
          <ExternalLink className="w-3 h-3" />
          فتح
        </div>
      </a>
      <div className="p-3 flex-1 flex flex-col">
        <h3 className="font-cairo font-bold text-sm line-clamp-2 mb-1">
          {book.title}
        </h3>
        {book.author && (
          <p className="text-xs text-muted line-clamp-1 mb-2">{book.author}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-[11px] text-muted uppercase">
            {book.format ?? 'pdf'}
          </span>
          <div className="flex items-center gap-0.5">
            <ReportButton kind="book" itemId={book.id} />
            <button
              onClick={onToggleSave}
              aria-label={isSaved ? 'إزالة من مكتبتي' : 'حفظ في مكتبتي'}
              className="p-1.5 rounded-full hover:bg-primary/10 transition"
            >
              <Heart
                className={`w-4 h-4 transition ${
                  isSaved ? 'fill-error text-error' : 'text-muted'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BooksPage() {
  return (
    <PlatformGate sectionName="الكتب">
      <BooksPageInner />
    </PlatformGate>
  );
}
