import { LegalLayout } from '@/components/legal/legal-layout';

export const metadata = {
  title: 'السجل التجاري — سادس ألترا',
  description: 'بيانات التسجيل الرسمي لشركة Sads Ultra L.L.C.',
};

export default function CommercialRegisterPage() {
  return (
    <LegalLayout
      lang="ar"
      title="السجل التجاري"
      lastUpdated="2026-06-07"
      switchHref="/commercial-register"
    >
      <Section title="بيانات الشركة الرسمية">
        <Row label="الاسم التجاري الرسمي">Sads Ultra L.L.C.</Row>
        <Row label="نوع الكيان القانوني">شركة محدودة المسؤولية (LLC)</Row>
        <Row label="ولاية التأسيس">Wyoming, USA</Row>
        <Row label="تاريخ التأسيس">14 مايو 2026</Row>
      </Section>

      <Section title="أرقام التسجيل">
        <Row label="رقم تسجيل الشركة (Filing ID)" ltr>2026-001977433</Row>
        <Row label="الرقم الضريبي الفيدرالي (EIN)" ltr>36-5180178</Row>
      </Section>

      <Section title="العنوان القانوني المسجل">
        <p className="text-foreground leading-loose" dir="ltr">
          30 N Gould St Ste N
          <br />
          Sheridan, WY 82801
          <br />
          United States of America
        </p>
      </Section>

      <Section title="معلومات التواصل">
        <Row label="البريد الإلكتروني" ltr>info@6thultra.com</Row>
      </Section>

      <Section title="النشاط المسجّل">
        <p className="text-muted-foreground leading-loose">
          تقديم خدمات تعليمية رقمية للطلبة، تتضمّن منصة دروس مدعومة بالذكاء
          الاصطناعي، مكتبة رقمية، محاضرات مرئية، ومنتدى تفاعلي لطلاب الصف
          السادس الإعدادي وفق المنهج العراقي.
        </p>
      </Section>
    </LegalLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold mb-3 text-foreground">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({
  label,
  children,
  ltr = false,
}: {
  label: string;
  children: React.ReactNode;
  ltr?: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3 py-1.5">
      <span className="text-muted-foreground text-sm sm:min-w-[230px]">
        {label}:
      </span>
      <span
        className="text-foreground font-medium"
        dir={ltr ? 'ltr' : undefined}
      >
        {children}
      </span>
    </div>
  );
}
