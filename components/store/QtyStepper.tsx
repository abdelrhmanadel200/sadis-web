'use client';

import { Minus, Plus } from 'lucide-react';

/** عداد كمية: زيادة / الرقم / إنقاص (الترتيب من اليمين) */
export default function QtyStepper({
  value,
  onChange,
  min = 1,
  max,
  disabled = false,
  size = 'md',
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max: number;
  disabled?: boolean;
  size?: 'sm' | 'md';
}) {
  const btn = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  const icon = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const top = Math.max(min, max);

  return (
    <div
      role="group"
      aria-label="الكمية"
      className="inline-flex items-center rounded-xl border border-dark-border overflow-hidden select-none"
    >
      <button
        type="button"
        onClick={() => onChange(Math.min(top, value + 1))}
        disabled={disabled || value >= top}
        aria-label="زيادة الكمية"
        className={`${btn} flex items-center justify-center hover-surface disabled:opacity-35 disabled:cursor-not-allowed`}
      >
        <Plus className={icon} />
      </button>
      <span
        aria-live="polite"
        className={`${size === 'sm' ? 'min-w-[2rem] text-sm' : 'min-w-[2.75rem]'} text-center font-bold tabular-nums`}
      >
        {value.toLocaleString('ar-IQ')}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label="إنقاص الكمية"
        className={`${btn} flex items-center justify-center hover-surface disabled:opacity-35 disabled:cursor-not-allowed`}
      >
        <Minus className={icon} />
      </button>
    </div>
  );
}
