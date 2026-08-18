'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  MessageSquare,
  BookOpen,
  ShoppingBag,
  Library,
  User,
  LogOut,
  Menu,
  X,
  Plus,
  Sparkles,
  Moon,
  Sun,
  Mic,
  PlayCircle,
  BookMarked,
  Users as UsersIcon,
  Crown,
  ClipboardList,
  MapPin,
  Send,
  CalendarDays,
  Newspaper,
  ListVideo,
  Handshake,
} from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import { supabase } from '@/lib/supabase';
import type { ChatSession } from '@/lib/types';

interface AppShellProps {
  children: ReactNode;
  /** Set true on pages that have their own scroll (chat). */
  fullHeight?: boolean;
}

export default function AppShell({ children, fullHeight }: AppShellProps) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  // Load chat sessions
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(30);
      if (!error && !cancelled) setSessions(data || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, pathname]);

  // Close mobile drawer on navigation
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted">
        جاري التحميل...
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="flex min-h-screen">
      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 h-14 surface border-b border-dark-border">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="menu"
          className="p-2"
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
        <Link href="/chat" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-light flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-cairo font-bold">SADIS</span>
        </Link>
        <button onClick={toggleTheme} aria-label="theme" className="p-2">
          {theme === 'dark' ? (
            <Sun className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </button>
      </header>

      {/* Sidebar - pinned to the right (RTL) */}
      <aside
        className={`
          fixed lg:static inset-y-0 right-0 lg:right-auto z-40 w-72 surface border-s border-dark-border
          transition-transform duration-300 flex flex-col
          ${open ? 'translate-x-0' : 'translate-x-full'} lg:translate-x-0
        `}
      >
        <div className="h-14 lg:h-16 px-4 flex items-center justify-between border-b border-dark-border">
          <Link href="/chat" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary-light flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-cairo font-bold">SADIS Ultra</span>
          </Link>
          <button
            onClick={toggleTheme}
            aria-label="theme"
            className="hidden lg:inline-flex p-2 rounded-lg hover:opacity-70 transition"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>
        </div>

        <div className="px-3 py-3">
          <Link
            href="/chat"
            className="flex items-center gap-2 rounded-xl border border-primary/50 text-primary-light hover:bg-primary/10 px-3 py-2 font-semibold"
          >
            <Plus className="w-5 h-5" />
            محادثة جديدة
          </Link>
        </div>

        <nav className="px-2 pb-2 space-y-0.5">
          <NavLink href="/chat" active={pathname === '/chat'} icon={<MessageSquare className="w-5 h-5" />} label="الدردشة" />
          {/* قسم قيد التطوير — يفتح صفحة تعريفية بشارة "قريباً". */}
          <Link
            href="/exam"
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              pathname.startsWith('/exam') ? 'bg-primary/15 text-primary-light' : 'hover-surface text-current'
            }`}
          >
            <ClipboardList className="w-5 h-5" />
            <span>امتحان إلكتروني</span>
            <span className="ms-auto text-[10px] font-bold bg-primary/15 text-primary px-2 py-0.5 rounded-full">قريباً</span>
          </Link>
          <NavLink href="/subjects" active={pathname.startsWith('/subjects')} icon={<BookOpen className="w-5 h-5" />} label="المواد" />
          {/* قسم المحاضرات فيه فرعان (محاضرات يوتيوب / قوائم تشغيل) — التنقل
              بينهما عبر تبويبات داخل الصفحة، فلا نكرّرهما في القائمة. */}
          <NavLink href="/lectures" active={pathname.startsWith('/lectures') || pathname.startsWith('/playlists')} icon={<PlayCircle className="w-5 h-5" />} label="المحاضرات" />
          <NavLink href="/books" active={pathname.startsWith('/books')} icon={<BookMarked className="w-5 h-5" />} label="الكتب" />
          <NavLink href="/library" active={pathname === '/library'} icon={<Library className="w-5 h-5" />} label="مكتبتي" />
          <NavLink href="/library/browse" active={pathname.startsWith('/library/browse')} icon={<UsersIcon className="w-5 h-5" />} label="مجتمع سادس" />
          <NavLink href="/institutes" active={pathname.startsWith('/institutes')} icon={<MapPin className="w-5 h-5" />} label="المعاهد" />
          <NavLink href="/telegram" active={pathname.startsWith('/telegram')} icon={<Send className="w-5 h-5" />} label="قنوات تليجرام" />
          <NavLink href="/calendar" active={pathname.startsWith('/calendar')} icon={<CalendarDays className="w-5 h-5" />} label="تقويم السادس" />
          <NavLink href="/news" active={pathname.startsWith('/news')} icon={<Newspaper className="w-5 h-5" />} label="أخبار السادس" />
          <a
            href="https://forum.6thultra.com/session/sso"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover-surface text-current"
          >
            <UsersIcon className="w-5 h-5" />
            <span>المنتدى</span>
          </a>
          <NavLink href="/store" active={pathname.startsWith('/store')} icon={<ShoppingBag className="w-5 h-5" />} label="المتجر" />
          <NavLink href="/affiliate" active={pathname.startsWith('/affiliate')} icon={<Handshake className="w-5 h-5" />} label="نظام المسوّقين" />
          <NavLink href="/account/subscription" active={pathname.startsWith('/account/subscription')} icon={<Crown className="w-5 h-5" />} label="الاشتراك" />
          <NavLink href="/profile" active={pathname.startsWith('/profile')} icon={<User className="w-5 h-5" />} label="حسابي" />
        </nav>

        <div className="px-4 pt-4 pb-1 text-xs uppercase tracking-wider text-muted">
          المحادثات السابقة
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
          {sessions.length === 0 && (
            <div className="text-sm text-muted px-3 py-2">لا توجد لديك محادثات بعد</div>
          )}
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/chat?session=${s.id}`}
              className="block rounded-lg px-3 py-2 text-sm hover-surface truncate"
              title={s.title ?? 'محادثة'}
            >
              {s.title || 'محادثة بدون عنوان'}
            </Link>
          ))}
        </div>

        <div className="border-t border-dark-border p-3">
          <button
            onClick={async () => {
              await signOut();
              router.replace('/');
            }}
            className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover-surface text-error"
          >
            <LogOut className="w-4 h-4" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Overlay on mobile */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
        />
      )}

      {/* Main */}
      <main
        className={`flex-1 ${fullHeight ? 'h-screen lg:h-screen' : ''} pt-14 lg:pt-0 min-w-0`}
      >
        {children}
      </main>
    </div>
  );
}

function NavLink({
  href,
  active,
  icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
        active
          ? 'bg-primary/15 text-primary-light'
          : 'hover-surface text-current'
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
