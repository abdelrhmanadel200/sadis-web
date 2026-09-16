'use client';

import { ReactNode } from 'react';
import { Gift } from 'lucide-react';
import { GOVERNORATES, formatIQD } from '@/lib/iraq';
import {
  estimateDeliveryFee,
  piecesLabel,
  remainingForFreeDelivery,
  type StoreSettings,
} from '@/lib/store';
import { fieldClass } from '@/components/store/StoreParts';

// المحافظة المختارة في السلة تنتقل لصفحة إكمال الطلب
const GOV_KEY = 'sadis_store_gov';

export function loadSavedGovernorate(): string {
  try {
    const v = window.sessionStorage.getItem(GOV_KEY) ?? '';
    return (GOVERNORATES as readonly string[]).includes(v) ? v : '';
  } catch {
    return '';
  }
}

export function saveGovernorate(v: string) {
  try {
    if (v) window.sessionStorage.setItem(GOV_KEY, v);
    else window.sessionStorage.removeItem(GOV_KEY);
  } catch {
    // التخزين ممنوع: نكمل بدونه
  }
}

export function GovernorateSelect({
  id,
  value,
  onChange,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        saveGovernorate(e.target.value);
      }}
      aria-invalid={invalid || undefined}
      className={`${fieldClass} ${invalid ? '!border-red-500' : ''}`}
    >
      <option value="">اختر المحافظة</option>
      {GOVERNORATES.map((g) => (
        <option key={g} value={g}>
          {g}
        </option>
      ))}
    </select>
  );
}

function Row({ label, value, strong }: { label: ReactNode; value: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${strong ? 'text-base font-extrabold' : 'text-sm'}`}>
      <span className={strong ? '' : 'text-muted'}>{label}</span>
      <span className="text-left tabular-nums">{value}</span>
    </div>
  );
}

/** المجموع وأجرة التوصيل التقديرية والمبلغ الكلي */
export function TotalsRows({
  settings,
  governorate,
  subtotal,
  itemsCount,
}: {
  settings: StoreSettings;
  governorate: string;
  subtotal: number;
  itemsCount: number;
}) {
  const fee = estimateDeliveryFee(settings, governorate, subtotal);
  const remaining = remainingForFreeDelivery(settings, subtotal);

  let feeText: ReactNode;
  if (!governorate) feeText = <span className="text-muted">اختر المحافظة</span>;
  else if (fee === null) feeText = <span className="text-muted">تحدد عند تأكيد الطلب</span>;
  else if (fee === 0) feeText = <span className="font-bold text-emerald-700 dark:text-emerald-300">مجاني</span>;
  else feeText = formatIQD(fee);

  return (
    <div className="space-y-2.5">
      <Row
        label={`المجموع (${piecesLabel(itemsCount)})`}
        value={formatIQD(subtotal)}
      />
      <Row label="أجرة التوصيل" value={feeText} />
      <div className="border-t border-dark-border pt-2.5">
        <Row
          strong
          label="المبلغ الكلي"
          value={fee === null ? `${formatIQD(subtotal)} + التوصيل` : formatIQD(subtotal + fee)}
        />
      </div>
      {settings.loaded && settings.freeMin > 0 && (
        <p className="flex items-start gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
          <Gift className="w-4 h-4 shrink-0" />
          {remaining > 0
            ? `أضف ${formatIQD(remaining)} وتحصل توصيل مجاني (للطلب من ${formatIQD(settings.freeMin)}).`
            : 'طلبك يستحق توصيل مجاني.'}
        </p>
      )}
    </div>
  );
}
