import { LegalLayout } from '@/components/legal/legal-layout';

export const metadata = {
  title: 'Privacy Policy — 6th Ultra',
  description: 'How 6th Ultra collects, uses, and protects user data.',
};

export default function PrivacyEnPage() {
  return (
    <LegalLayout
      lang="en"
      title="Privacy Policy"
      lastUpdated="2026-05-13"
      switchHref="/privacy"
    >
      <Section title="1. Introduction">
        6th Ultra is committed to protecting the privacy of its users. This
        policy explains what data we collect, how we use it, and how we
        protect it.
      </Section>

      <Section title="2. Data We Collect">
        We collect the following data only to deliver and improve the service:
        <br />- Account data: name, email, phone, governorate, study track.
        <br />- Usage data: login timestamps, subjects viewed, stored chats.
        <br />- Payment data: handled entirely by PayPro Global. We never
        store credit card details on our servers.
      </Section>

      <Section title="3. How We Use Your Data">
        - To deliver AI tutoring, chat, and explanations.
        <br />- To improve answer accuracy and user experience.
        <br />- To send subscription and billing notifications.
        <br />- To comply with legal and accounting obligations.
      </Section>

      <Section title="4. Data Sharing">
        We do not sell or rent your data. We share the minimum necessary data
        with:
        <br />- OpenAI (to process AI requests).
        <br />- Supabase (database hosting).
        <br />- PayPro Global (payment processing).
        <br />All these providers are bound by strict data protection
        standards (GDPR / SOC 2).
      </Section>

      <Section title="5. Data Retention">
        We retain your account and chats while your subscription is active.
        When you request account deletion, we remove all data within 30 days,
        except accounting records that we are legally required to keep.
      </Section>

      <Section title="6. Your Rights">
        You have the right to access, correct, or delete your data. Contact us
        at
        <a className="text-primary" href="mailto:privacy@6thultra.com">
          {' '}
          privacy@6thultra.com{' '}
        </a>
        and we will respond within 7 business days.
      </Section>

      <Section title="7. Cookies">
        We use technical cookies to keep you signed in and remember your
        preferences. We do not use ad cookies or cross-site trackers.
      </Section>

      <Section title="8. Security">
        We use TLS encryption for all traffic, bcrypt for password storage,
        and Row Level Security to isolate user data in the database.
      </Section>

      <Section title="9. Policy Updates">
        We may update this policy. Material changes will be notified by email
        or in-app notice at least 14 days before taking effect.
      </Section>

      <Section title="10. Contact">
        For privacy inquiries, email
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
