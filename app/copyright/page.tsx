import Link from 'next/link';
import { ArrowRight, Copyright, Flag, ShieldAlert, Trash2 } from 'lucide-react';

export const metadata = {
  title: 'سياسة حقوق الطبع والنشر — سادس ألترا',
  description: 'سياسة حقوق النشر والتعامل مع الملفات المرفوعة من الأعضاء في منصة سادس ألترا.',
};

/**
 * سياسة حقوق الطبع والنشر — تُعرض للطلاب من شريط إخلاء المسؤولية في
 * مكتبة سادس ومن نموذج المشاركة.
 */
export default function CopyrightPage() {
  return (
    <main className="min-h-screen bg-background text-foreground" dir="rtl">
      <div className="max-w-3xl mx-auto px-5 py-10">
        <Link
          href="/library/browse"
          className="inline-flex items-center gap-2 text-sm text-muted hover:opacity-80 mb-6"
        >
          <ArrowRight className="w-4 h-4" />
          العودة لمكتبة سادس
        </Link>

        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Copyright className="w-7 h-7 text-primary-light" />
            سياسة حقوق الطبع والنشر
          </h1>
          <p className="text-muted">
            آخر تحديث: أيلول 2026
          </p>
        </header>

        <div className="space-y-6 leading-relaxed">
          <section className="card border border-dark-border rounded-2xl p-5">
            <h2 className="font-bold text-lg mb-2 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              الملفات المرفوعة من الأعضاء
            </h2>
            <p className="text-sm text-muted">
              مكتبة سادس مساحة يشارك فيها طلاب المنصة ملفاتهم وملاحظاتهم مع
              بعضهم. هذه الملفات يرفعها الأعضاء أنفسهم، ومنصة سادس ألترا
              <span className="font-bold text-foreground"> غير مسؤولة عن محتواها </span>
              ولا تدّعي ملكيتها. مسؤولية التأكد من حق نشر أي ملف تقع على
              العضو الذي رفعه.
            </p>
          </section>

          <section className="card border border-dark-border rounded-2xl p-5">
            <h2 className="font-bold text-lg mb-2">التزامات العضو عند الرفع</h2>
            <ul className="text-sm text-muted space-y-2 list-disc pr-5">
              <li>لا ترفع ملفاً لا تملك حق نشره أو مشاركته.</li>
              <li>
                الملازم والكتب التجارية المدفوعة الخاصة بأساتذة أو دور نشر لا
                يجوز رفعها دون إذن صاحبها.
              </li>
              <li>
                برفعك أي ملف فأنت تقرّ بأنك تملك حق مشاركته وتتحمل وحدك
                المسؤولية القانونية المترتبة على نشره.
              </li>
            </ul>
          </section>

          <section className="card border border-dark-border rounded-2xl p-5">
            <h2 className="font-bold text-lg mb-2 flex items-center gap-2">
              <Flag className="w-5 h-5 text-red-400" />
              الإبلاغ عن انتهاك حقوق النشر
            </h2>
            <p className="text-sm text-muted mb-2">
              إذا كنت صاحب حق (أستاذاً أو دار نشر أو مؤلفاً) ووجدت محتوى لك
              منشوراً دون إذنك، أو كنت طالباً ولاحظت ملفاً مخالفاً:
            </p>
            <ul className="text-sm text-muted space-y-2 list-disc pr-5">
              <li>
                اضغط زر <span className="font-bold text-foreground">الإبلاغ</span>{' '}
                الظاهر على بطاقة الملف داخل مكتبة سادس واذكر سبب البلاغ.
              </li>
              <li>
                تراجع الإدارة البلاغات أولاً بأول، ويُزال أي محتوى يثبت أنه
                منتهك لحقوق النشر.
              </li>
            </ul>
          </section>

          <section className="card border border-dark-border rounded-2xl p-5">
            <h2 className="font-bold text-lg mb-2 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-muted" />
              إزالة المحتوى والجزاءات
            </h2>
            <ul className="text-sm text-muted space-y-2 list-disc pr-5">
              <li>تحتفظ الإدارة بحق إزالة أي ملف دون إشعار مسبق.</li>
              <li>
                تكرار رفع محتوى منتهك لحقوق النشر قد يؤدي إلى إيقاف حساب
                العضو نهائياً.
              </li>
            </ul>
            <p className="text-sm text-muted mt-3">
              لأي استفسار حول هذه السياسة راجع أيضاً{' '}
              <Link href="/terms" className="text-primary hover:underline">
                شروط الاستخدام
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
