'use client';

import PlatformGate from '@/components/PlatformGate';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Heart,
  Play,
  X,
  ArrowRight,
  Search,
  Clock,
  User as UserIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  fetchSavedIds,
  toggleSave,
  youtubeEmbedUrl,
  youtubeThumb,
} from '@/lib/saved-items';
import { DEFAULT_SUBJECTS } from '@/lib/subjects';
import { ReportButton } from '@/components/ReportButton';

interface Lecture {
  id: string;
  subject_id: string | null;
  title: string;
  description: string | null;
  teacher_name: string | null;
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  chapter_order: number;
}

function LecturesPageInner() {
  const { user } = useAuth();
  const router = useRouter();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [openLecture, setOpenLecture] = useState<Lecture | null>(null);

  const subjects = useMemo(
    () =>
      [{ id: 'all', name_ar: 'الكل', name_en: 'All' }] as Array<{
        id: string;
        name_ar: string;
        name_en?: string | null;
      }>,
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: rows }, savedSet] = await Promise.all([
        supabase
          .from('lectures')
          .select('*')
          .order('chapter_order', { ascending: true }),
        fetchSavedIds(supabase, user?.id, 'lecture'),
      ]);
      if (cancelled) return;
      setLectures((rows ?? []) as Lecture[]);
      setSaved(savedSet);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleToggleSave = useCallback(
    async (lectureId: string) => {
      if (!user) {
        router.push('/login');
        return;
      }
      const wasSaved = saved.has(lectureId);
      // Optimistic update.
      setSaved((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.delete(lectureId);
        else next.add(lectureId);
        return next;
      });
      await toggleSave(supabase, user.id, 'lecture', lectureId, wasSaved);
    },
    [user, saved, router],
  );

  const visible = lectures.filter((l) => {
    if (subjectFilter !== 'all' && l.subject_id !== subjectFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${l.title} ${l.teacher_name ?? ''} ${l.description ?? ''}`.toLowerCase();
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

        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            المحاضرات المرئية
          </h1>
          <p className="text-muted">
            فيديوهات شرح من أساتذة معتمدين — تتشغّل كلها داخل الموقع.
          </p>
        </header>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث في المحاضرات..."
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

        {/* Grid */}
        {loading ? (
          <div className="py-10 text-center text-muted">جاري التحميل...</div>
        ) : visible.length === 0 ? (
          <div className="py-10 text-center text-muted">
            لا توجد محاضرات في هذا القسم الآن.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {visible.map((l) => (
              <LectureCard
                key={l.id}
                lecture={l}
                isSaved={saved.has(l.id)}
                onOpen={() => setOpenLecture(l)}
                onToggleSave={() => handleToggleSave(l.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* In-page video modal */}
      {openLecture && (
        <VideoModal
          lecture={openLecture}
          onClose={() => setOpenLecture(null)}
        />
      )}
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

function LectureCard({
  lecture,
  isSaved,
  onOpen,
  onToggleSave,
}: {
  lecture: Lecture;
  isSaved: boolean;
  onOpen: () => void;
  onToggleSave: () => void;
}) {
  const thumb = lecture.thumbnail_url || youtubeThumb(lecture.video_url) || '';
  return (
    <div className="card border border-dark-border rounded-2xl overflow-hidden flex flex-col group">
      <button onClick={onOpen} className="relative aspect-video bg-card/40 block">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt={lecture.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5" />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-90 group-hover:opacity-100 transition">
          <div className="w-12 h-12 rounded-full bg-white/95 flex items-center justify-center">
            <Play className="w-5 h-5 text-primary ms-0.5" fill="currentColor" />
          </div>
        </div>
      </button>
      <div className="p-3 flex-1 flex flex-col">
        <h3 className="font-cairo font-bold text-sm line-clamp-2 mb-1">
          {lecture.title}
        </h3>
        {lecture.teacher_name && (
          <p className="text-xs text-muted flex items-center gap-1 mb-2">
            <UserIcon className="w-3 h-3" />
            {lecture.teacher_name}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          {lecture.duration_seconds ? (
            <span className="text-[11px] text-muted flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(lecture.duration_seconds)}
            </span>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-0.5">
            <ReportButton kind="lecture" itemId={lecture.id} />
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

function VideoModal({
  lecture,
  onClose,
}: {
  lecture: Lecture;
  onClose: () => void;
}) {
  const embedUrl = youtubeEmbedUrl(lecture.video_url);
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl bg-card rounded-2xl overflow-hidden border border-dark-border"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border">
          <div>
            <h3 className="font-bold">{lecture.title}</h3>
            {lecture.teacher_name && (
              <p className="text-xs text-muted">{lecture.teacher_name}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="w-9 h-9 rounded-full hover:bg-primary/10 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="aspect-video bg-black">
          {embedUrl ? (
            <iframe
              src={embedUrl + '&autoplay=1'}
              title={lecture.title}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted text-sm">
              لا يمكن تشغيل هذا الفيديو
            </div>
          )}
        </div>
        {lecture.description && (
          <div className="px-4 py-3 text-sm text-muted leading-relaxed">
            {lecture.description}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function LecturesPage() {
  return (
    <PlatformGate sectionName="المحاضرات">
      <LecturesPageInner />
    </PlatformGate>
  );
}
