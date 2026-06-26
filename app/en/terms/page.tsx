import { LegalLayout } from '@/components/legal/legal-layout';

export const metadata = {
  title: 'Terms of Service — 6th Ultra',
  description: 'Terms and conditions governing the use of the 6th Ultra platform.',
};

export default function TermsEnPage() {
  return (
    <LegalLayout
      lang="en"
      title="Terms of Service"
      lastUpdated="2026-05-13"
      switchHref="/terms"
    >
      <Section title="1. Introduction">
        Welcome to 6th Ultra (sadisultra.com / 6thultra.com). By using the
        website or the app you agree to be bound by these terms. If you do not
        agree with any part of them, please discontinue use of the service.
      </Section>

      <Section title="2. Description of Service">
        6th Ultra is an AI-powered educational platform that delivers content
        for Iraqi 6th-grade preparatory students, including: an AI tutor for
        Q&A, curriculum summarisation, image-based problem solving, and live
        voice conversations.
      </Section>

      <Section title="3. Account & Subscription">
        Users must provide accurate information at registration and keep their
        credentials confidential. Subscriptions are personal and non-
        transferable. Account sharing or resale of access will result in
        immediate suspension without notice.
      </Section>

      <Section title="4. Payments">
        Payments are processed through our official payment gateway (PayPro
        Global). Each subscription has a defined validity period displayed at
        checkout. Subscriptions renew manually unless explicitly stated.
        Pricing may change with at least 14 days advance notice.
      </Section>

      <Section title="5. Acceptable Use">
        Users are granted a personal, non-exclusive license to use the content
        for educational purposes only. The following are prohibited:
        automated scraping, redistribution, training other models on our
        content, or any commercial use.
      </Section>

      <Section title="6. Intellectual Property">
        All content, logos, designs, and source code are owned by or licensed
        to 6th Ultra. Users may not copy, modify, or distribute them without
        prior written permission.
      </Section>

      <Section title="7. Limitation of Liability">
        Content is provided "as is" as an educational aid. The platform is not
        liable for academic decisions or test outcomes that rely solely on AI
        answers. Always cross-reference official curriculum sources.
      </Section>

      <Section title="8. Termination">
        We reserve the right to suspend or terminate any account that breaches
        these terms, violates applicable law, or harms other users.
      </Section>

      <Section title="9. Governing Law">
        These terms are governed by the laws of the Republic of Iraq. Any
        dispute will be resolved by the competent courts of Baghdad.
      </Section>

      <Section title="10. Contact">
        For any inquiry, email us at
        <a className="text-primary" href="mailto:support@6thultra.com">
          {' '}
          support@6thultra.com
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
