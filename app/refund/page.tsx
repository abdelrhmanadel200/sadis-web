import { LegalLayout } from '@/components/legal/legal-layout';

export const metadata = {
  title: 'سياسة الاسترجاع — سادس ألترا',
  description: 'سياسة استرجاع المدفوعات الخاصة بـ سادس ألترا.',
};

export default function RefundArPage() {
  return (
    <LegalLayout
      lang="ar"
      title="سياسة الاسترجاع"
      lastUpdated="2026-05-13"
      switchHref="/en/refund"
    >
      <Section title="١. الفترة المسموح فيها بالاسترجاع">
        يحق للمشترك طلب استرجاع كامل قيمة الاشتراك خلال ٧ أيام من تاريخ الشراء،
        بشرط ألا يكون استهلك أكثر من ١٠٪ من الميزات (محادثات الذكاء الاصطناعي،
        تحليل الصور، الوقت الصوتي).
      </Section>

      <Section title="٢. الحالات غير المؤهلة للاسترجاع">
        - مضى أكثر من ٧ أيام على الشراء.
        <br />- استهلاك يتجاوز ١٠٪ من الميزات المتاحة في الباقة.
        <br />- مخالفة شروط الخدمة (مشاركة الحساب، إعادة البيع، استخدام آلي
        لاستخراج المحتوى).
        <br />- اشتراكات المؤسسات والمدارس التي تخضع لعقود منفصلة.
      </Section>

      <Section title="٣. كيف تطلب الاسترجاع">
        أرسل بريداً إلى
        <a className="text-primary" href="mailto:billing@6thultra.com">
          {' '}
          billing@6thultra.com{' '}
        </a>
        يحتوي على:
        <br />- البريد الإلكتروني المسجّل في حسابك.
        <br />- رقم الفاتورة (موجود في إيميل تأكيد الاشتراك).
        <br />- سبب طلب الاسترجاع.
      </Section>

      <Section title="٤. مدة معالجة الطلب">
        نراجع كل طلب خلال يومي عمل. عند الموافقة، يُعاد المبلغ إلى نفس وسيلة
        الدفع المستخدمة في الشراء خلال ٥-١٠ أيام عمل حسب البنك المصدر.
      </Section>

      <Section title="٥. الاسترجاع التلقائي">
        في الحالات التالية يُعاد المبلغ تلقائياً بدون الحاجة لطلب:
        <br />- انقطاع كامل في الخدمة يتجاوز ٢٤ ساعة متواصلة.
        <br />- خطأ فني يمنع الوصول لميزة مدفوعة لأكثر من ٤٨ ساعة.
        <br />- خصم مزدوج من نفس البطاقة لنفس الاشتراك.
      </Section>

      <Section title="٦. التواصل والاعتراض">
        إذا رُفض طلبك ولم توافق على الرفض، يمكنك التصعيد عبر
        <a className="text-primary" href="mailto:support@6thultra.com">
          {' '}
          support@6thultra.com{' '}
        </a>
        وستتم مراجعة الحالة من طرف مدير الخدمة خلال ٥ أيام.
      </Section>
    </LegalLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-bold mb-3">{title}</h2>
      <p className="text-muted-foreground leading-loose">{children}</p>
    </section>
  );
}
