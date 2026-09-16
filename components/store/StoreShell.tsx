'use client';

import { ReactNode, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogIn, Moon, Sparkles, Sun } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/components/providers/AuthProvider';
import { useTheme } from '@/components/providers/ThemeProvider';

function FullLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center text-muted">
      جاري التحميل...
    </div>
  );
}

/**
 * غلاف صفحات المتجر.
 * المسجل يرى AppShell كباقي الصفحات. الزائر يتصفح المتجر بدون دخول بإطار بسيط
 * (AppShell نفسه يحول الزائر لصفحة الدخول). requireAuth للسلة والطلبات.
 */
export default function StoreShell({
  children,
  requireAuth = false,
}: {
  children: ReactNode;
  requireAuth?: boolean;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (requireAuth && !loading && !user) {
      const here = window.location.pathname + window.location.search;
      router.replace('/login?next=' + encodeURIComponent(here));
    }
  }, [requireAuth, loading, user, router]);

  if (loading) return <FullLoader />;
  if (user) return <AppShell>{children}</AppShell>;
  if (requireAuth) return <FullLoader />;
  return <PublicStoreFrame>{children}</PublicStoreFrame>;
}

function PublicStoreFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const loginHref = '/login?next=' + encodeURIComponent(pathname || '/store');

  return (
    <div className="min-h-screen" dir="rtl">
      <header className="sticky top-0 z-40 surface border-b border-dark-border">
        <div className="max-w-6xl mx-auto h-14 px-4 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-light flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-cairo font-bold truncate">سادس ألترا</span>
          </Link>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="تغيير المظهر"
              className="p-2 rounded-lg hover-surface"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <Link
              href={loginHref}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold bg-primary text-primary-foreground hover:opacity-90 transition"
            >
              <LogIn className="w-4 h-4" />
              تسجيل الدخول
            </Link>
          </div>
        </div>
      </header>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
