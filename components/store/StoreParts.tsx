'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, Info, Store, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/** رابط رجوع أعلى الصفحة (السهم لليمين في RTL) */
export function StoreBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 text-sm text-muted hover:opacity-80 mb-4"
    >
      <ArrowRight className="w-4 h-4" />
      {label}
    </Link>
  );
}

/** عنوان صفحة من صفحات المتجر */
export function StorePageTitle({
  icon,
  title,
  subtitle,
  actions,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5">
      <h1 className="font-cairo font-extrabold text-2xl md:text-3xl flex items-center gap-2">
        {icon}
        {title}
      </h1>
      {subtitle && <p className="text-muted text-sm md:text-base mt-1.5 leading-relaxed">{subtitle}</p>}
      {actions && <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

type NoticeTone = 'info' | 'warning' | 'error' | 'success';

const TONES: Record<NoticeTone, string> = {
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-200',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200',
  error: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
};

/** شريط تنبيه بلون حسب النوع */
export function StoreNotice({
  tone = 'info',
  title,
  children,
  onClose,
  icon,
  className,
}: {
  tone?: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  onClose?: () => void;
  icon?: ReactNode;
  className?: string;
}) {
  const Icon = tone === 'error' || tone === 'warning' ? AlertCircle : Info;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('rounded-2xl border px-4 py-3 flex items-start gap-3 text-sm', TONES[tone], className)}
    >
      <span className="mt-0.5 shrink-0">{icon ?? <Icon className="w-5 h-5" />}</span>
      <div className="flex-1 min-w-0 leading-relaxed">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق التنبيه"
          className="shrink-0 p-1 -m-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/** تنبيه المتجر المغلق */
export function StoreClosedNotice({ className }: { className?: string }) {
  return (
    <StoreNotice
      tone="warning"
      icon={<Store className="w-5 h-5" />}
      title="استقبال الطلبات متوقف مؤقتا"
      className={className}
    >
      تقدر تتصفح المنتجات، والطلب يرجع يشتغل قريبا.
    </StoreNotice>
  );
}

/** حالة فارغة أو رسالة وسط الصفحة */
export function StoreEmpty({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="card border border-dark-border rounded-2xl px-6 py-12 text-center">
      <div className="mx-auto w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mb-4 text-primary-light">
        {icon}
      </div>
      <h2 className="font-cairo font-bold text-lg mb-1.5">{title}</h2>
      {children && <p className="text-muted text-sm leading-relaxed max-w-sm mx-auto">{children}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold bg-primary text-primary-foreground hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed';

export const ghostBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold border border-dark-border hover-surface transition disabled:opacity-50 disabled:cursor-not-allowed';

export const fieldClass =
  'input-field w-full rounded-xl px-3.5 py-3 text-base outline-none focus:border-primary transition';
