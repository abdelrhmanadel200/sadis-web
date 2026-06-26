import { LegalLayout } from '@/components/legal/legal-layout';

export const metadata = {
  title: 'سياسة الخصوصية — سادس ألترا',
  description: 'كيف نجمع ونستخدم ونحمي بياناتك على منصة سادس ألترا.',
};

export default function PrivacyArPage() {
  return (
    <LegalLayout
      lang="ar"
      title="سياسة الخصوصية"
      lastUpdated="2026-05-13"
      switchHref="/en/privacy"
    >
      <Section title="١. مقدمة">
        نحن في سادس ألترا نلتزم بحماية خصوصية مستخدمينا. توضح هذه السياسة نوع
        البيانات التي نجمعها وكيف نستخدمها ونحميها.
      </Section>

      <Section title="٢. البيانات التي نجمعها">
        نجمع البيانات التالية فقط لتقديم الخدمة وتحسينها:
        <br />- بيانات الحساب: الاسم، البريد الإلكتروني، رقم الهاتف، المحافظة،
        الفرع الدراسي.
        <br />- بيانات الاستخدام: تاريخ الدخول، المواد المُتصفّحة، المحادثات
        المخزّنة.
        <br />- بيانات الدفع: تُعالَج بالكامل عبر بوابة الدفع PayPro Global ولا
        نخزّن أي بيانات بطاقات ائتمانية على خوادمنا.
      </Section>

      <Section title="٣. كيف نستخدم بياناتك">
        - لتقديم خدمات الذكاء الاصطناعي والمحادثة والشرح.
        <br />- لتحسين دقة الإجابات وتجربة الاستخدام.
        <br />- لإرسال تنبيهات الاشتراك ومعلومات الفواتير.
        <br />- للامتثال للالتزامات القانونية والمحاسبية.
      </Section>

      <Section title="٤. مشاركة البيانات">
        لا نبيع أو نؤجّر بياناتك لأي طرف ثالث. نشارك الحد الأدنى من البيانات
        فقط مع:
        <br />- OpenAI (لمعالجة طلبات الذكاء الاصطناعي).
        <br />- Supabase (لاستضافة قاعدة البيانات).
        <br />- PayPro Global (لمعالجة المدفوعات).
        <br />جميع هؤلاء يلتزمون بمعايير حماية بيانات صارمة (GDPR/SOC2).
      </Section>

      <Section title="٥. الاحتفاظ بالبيانات">
        نحتفظ بحسابك ومحادثاتك طالما اشتراكك نشط. عند طلب حذف الحساب، نُزيل
        جميع بياناتك خلال ٣٠ يوماً، باستثناء السجلات المحاسبية التي يلزمنا
        القانون الاحتفاظ بها.
      </Section>

      <Section title="٦. حقوقك">
        لك الحق في طلب الاطلاع على بياناتك، تصحيحها، أو حذفها بالكامل. تواصل
        معنا على
        <a className="text-primary" href="mailto:privacy@6thultra.com">
          {' '}
          privacy@6thultra.com{' '}
        </a>
        وسنرد خلال ٧ أيام عمل.
      </Section>

      <Section title="٧. ملفات تعريف الارتباط (Cookies)">
        نستخدم cookies تقنية لإبقائك مسجل الدخول وتذكّر تفضيلاتك. لا نستخدم
        cookies للإعلانات ولا نتتبعك عبر مواقع خارجية.
      </Section>

      <Section title="٨. الأمان">
        نطبّق تشفير TLS لكل الاتصالات، وتخزين كلمات المرور بـ bcrypt، وعزل
        البيانات بين المستخدمين عبر Row Level Security في قاعدة البيانات.
      </Section>

      <Section title="٩. التغييرات على السياسة">
        قد نُحدّث هذه السياسة من وقت لآخر. سنُبلغك بأي تغييرات جوهرية عبر
        البريد الإلكتروني أو إشعار داخل التطبيق قبل سريانها بـ ١٤ يوماً.
      </Section>

      <Section title="١٠. التواصل">
        لأي استفسار يتعلق بالخصوصية، راسلنا على
        <a className="text-primary" href="mailto:privacy@6thultra.com">
          {' '}
          privacy@6thultra.com
        </a>
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
