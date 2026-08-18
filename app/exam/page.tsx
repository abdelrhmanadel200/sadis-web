'use client';

import Link from 'next/link';
import { ArrowRight, ClipboardList } from 'lucide-react';

/**
 * قسم الامتحان الإلكتروني — قيد التطوير.
 * حلّ محل "الصوت الحي" في القائمة بطلب العميل؛ صفحة /voice ما زالت موجودة
 * (الكود محفوظ) لكنها لم تعد معروضة للطلاب.
 */
export default function ExamPage() {
  return (
    <main className="min-h-screen bg-background text-foreground" dir="rtl">
      <div className="max-w-2xl mx-auto px-5 py-16 text-center">
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 text-sm text-muted hover:opacity-80 mb-10"
        >
          <ArrowRight className="w-4 h-4" />
          العودة
        </Link>

        <div className="mx-auto w-24 h-24 rounded-full bg-primary/15 flex items-center justify-center mb-8">
          <ClipboardList className="w-12 h-12 text-primary" />
        </div>

        <h1 className="text-3xl md:text-4xl font-bold mb-3">الامتحان الإلكتروني</h1>
        <span className="inline-block text-sm font-bold bg-primary/15 text-primary px-4 py-1.5 rounded-full mb-6">
          قريباً
        </span>
        <p className="text-muted leading-relaxed max-w-md mx-auto">
          نعمل حالياً على قسم الامتحانات الإلكترونية ليتمكّن الطالب من اختبار نفسه
          بأسئلة على نمط الوزاري ومعرفة نتيجته فوراً. ترقّبوه قريباً بإذن الله.
        </p>
      </div>
    </main>
  );
}
