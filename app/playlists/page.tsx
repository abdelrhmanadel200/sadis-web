'use client';

import PlatformGate from '@/components/PlatformGate';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Loader2, Play, X, ListVideo, User as UserIcon, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DEFAULT_SUBJECTS } from '@/lib/subjects';

interface Playlist {
  id: string;
  title: string;
  playlist_url: string;
  teacher_name: string | null;
  subject_id: string | null;
  thumbnail_url: string | null;
  description: string | null;
  sort_order: number;
}

function playlistId(url: string): string | null {
  const m = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

function PlaylistsInner() {
  const [rows, setRows] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Playlist | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('youtube_playlists')
        .select('*')
        .order('sort_order', { ascending: true });
      if (cancelled) return;
      setRows((data ?? []) as Playlist[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = rows.filter((p) => {
    if (subjectFilter !== 'all' && p.subject_id !== subjectFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!`${p.title} ${p.teacher_name ?? ''}`.toLowerCase().includes(q)) return false;
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

        <header className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">المحاضرات المرئية</h1>
          <p className="text-muted">
            سلاسل حلقات الأساتذة على يوتيوب — تُفتح كقائمة تشغيل كاملة داخل الموقع.
          </p>
        </header>

        {/* فرعا القسم: محاضرات مفردة أو سلاسل (قوائم تشغيل) */}
        <div className="flex flex-wrap gap-2 mb-5 border-b border-dark-border pb-3">
          <Link
            href="/lectures"
            className="px-4 py-2 rounded-xl text-sm font-bold bg-card/40 text-muted hover:text-foreground transition"
          >
            محاضرات يوتيوب
          </Link>
          <span className="px-4 py-2 rounded-xl text-sm font-bold bg-primary text-white">
            قوائم التشغيل
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث في القوائم..."
              className="w-full rounded-xl bg-card/40 border border-dark-border ps-9 pe-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip label="الكل" active={subjectFilter === 'all'} onClick={() => setSubjectFilter('all')} />
            {DEFAULT_SUBJECTS.map((s) => (
              <Chip
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
          <div className="py-10 text-center text-muted">لا توجد قوائم في هذا القسم.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {visible.map((p) => (
              <PlaylistCard key={p.id} p={p} onOpen={() => setOpen(p)} />
            ))}
          </div>
        )}
      </div>

      {open && <PlaylistModal p={open} onClose={() => setOpen(null)} />}
    </main>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
        active ? 'bg-primary text-white border-primary' : 'border-dark-border text-muted hover:border-primary/40'
      }`}
    >
      {label}
    </button>
  );
}

function PlaylistCard({ p, onOpen }: { p: Playlist; onOpen: () => void }) {
  return (
    <div className="card border border-dark-border rounded-2xl overflow-hidden flex flex-col group">
      <button onClick={onOpen} className="relative aspect-video bg-card/40 block">
        {p.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.thumbnail_url} alt={p.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <ListVideo className="w-10 h-10 text-primary-light/70" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-90 group-hover:opacity-100 transition">
          <div className="w-12 h-12 rounded-full bg-white/95 flex items-center justify-center">
            <Play className="w-5 h-5 text-primary ms-0.5" fill="currentColor" />
          </div>
        </div>
        <span className="absolute bottom-2 start-2 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded flex items-center gap-1">
          <ListVideo className="w-3 h-3" /> قائمة
        </span>
      </button>
      <div className="p-3 flex-1 flex flex-col">
        <h3 className="font-cairo font-bold text-sm line-clamp-2 mb-1">{p.title}</h3>
        {p.teacher_name && (
          <p className="text-xs text-muted flex items-center gap-1">
            <UserIcon className="w-3 h-3" />
            {p.teacher_name}
          </p>
        )}
      </div>
    </div>
  );
}

function PlaylistModal({ p, onClose }: { p: Playlist; onClose: () => void }) {
  const listId = useMemo(() => playlistId(p.playlist_url), [p.playlist_url]);
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
            <h3 className="font-bold">{p.title}</h3>
            {p.teacher_name && <p className="text-xs text-muted">{p.teacher_name}</p>}
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
          {listId ? (
            <iframe
              src={`https://www.youtube.com/embed/videoseries?list=${listId}`}
              title={p.title}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted text-sm gap-3">
              <span>تعذّر تضمين القائمة</span>
              <a
                href={p.playlist_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-primary text-primary-foreground font-bold px-4 py-2 text-sm"
              >
                فتح في يوتيوب
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PlaylistsPage() {
  return (
    <PlatformGate sectionName="قوائم التشغيل">
      <PlaylistsInner />
    </PlatformGate>
  );
}
