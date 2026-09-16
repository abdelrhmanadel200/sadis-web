'use client';

import { useEffect, useState } from 'react';
import {
  BookOpen,
  FileText,
  NotebookPen,
  Package,
  PencilRuler,
  type LucideIcon,
} from 'lucide-react';
import { formatIQD } from '@/lib/iraq';
import { cn } from '@/lib/utils';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  books: BookOpen,
  booklets: FileText,
  stationery: PencilRuler,
  notebooks: NotebookPen,
};

export function categoryIcon(category: string | null | undefined): LucideIcon {
  return CATEGORY_ICONS[category ?? ''] ?? Package;
}

/** صورة المنتج، وأيقونة الفرع إن لم توجد صورة أو فشل تحميلها */
export function ProductThumb({
  src,
  alt,
  category,
  className,
  iconClassName,
  fit = 'cover',
}: {
  src: string | null | undefined;
  alt: string;
  category?: string | null;
  className?: string;
  iconClassName?: string;
  fit?: 'cover' | 'contain';
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const Icon = categoryIcon(category);

  if (!src || failed) {
    return (
      <div
        className={cn(
          'w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5',
          className,
        )}
        aria-hidden
      >
        <Icon className={iconClassName ?? 'w-10 h-10 text-primary-light/70'} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn(
        'w-full h-full',
        fit === 'cover' ? 'object-cover' : 'object-contain',
        className,
      )}
    />
  );
}

/** السعر، والسعر القديم مشطوبا عند وجود خصم */
export function Price({
  price,
  compareAt,
  size = 'sm',
  className,
}: {
  price: number;
  compareAt?: number | null;
  size?: 'sm' | 'lg';
  className?: string;
}) {
  const discounted = compareAt !== null && compareAt !== undefined && compareAt > price;
  return (
    <div className={cn('flex items-baseline gap-x-2 gap-y-0.5 flex-wrap', className)}>
      <span className={cn('font-extrabold', size === 'lg' ? 'text-2xl' : 'text-sm')}>
        {formatIQD(price)}
      </span>
      {discounted && (
        <span className={cn('text-muted line-through', size === 'lg' ? 'text-base' : 'text-[11px]')}>
          {formatIQD(compareAt)}
        </span>
      )}
    </div>
  );
}
