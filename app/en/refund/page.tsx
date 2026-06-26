import { LegalLayout } from '@/components/legal/legal-layout';

export const metadata = {
  title: 'Refund Policy — 6th Ultra',
  description: 'Refund policy for 6th Ultra subscriptions.',
};

export default function RefundEnPage() {
  return (
    <LegalLayout
      lang="en"
      title="Refund Policy"
      lastUpdated="2026-05-13"
      switchHref="/refund"
    >
      <Section title="1. Refund Window">
        Subscribers may request a full refund within 7 days of purchase,
        provided they have consumed no more than 10% of the included features
        (AI chats, image analysis, voice time).
      </Section>

      <Section title="2. Non-Refundable Cases">
        - More than 7 days have passed since purchase.
        <br />- Feature usage exceeds 10% of the plan's quota.
        <br />- Breach of Terms (account sharing, resale, automated scraping).
        <br />- Institutional / school subscriptions covered by separate
        contracts.
      </Section>

      <Section title="3. How to Request a Refund">
        Email
        <a className="text-primary" href="mailto:billing@6thultra.com">
          {' '}
          billing@6thultra.com{' '}
        </a>
        with:
        <br />- The email registered on your account.
        <br />- The invoice number (in your subscription-confirmation email).
        <br />- Reason for the refund request.
      </Section>

      <Section title="4. Processing Time">
        We review each request within 2 business days. Approved refunds are
        returned to the original payment method within 5-10 business days,
        depending on the issuing bank.
      </Section>

      <Section title="5. Automatic Refunds">
        We will refund automatically, without a request, in the following
        cases:
        <br />- Full service outage exceeding 24 continuous hours.
        <br />- A technical defect blocking access to a paid feature for over
        48 hours.
        <br />- Duplicate charge on the same card for the same subscription.
      </Section>

      <Section title="6. Escalation">
        If your request is declined and you disagree, you may escalate to
        <a className="text-primary" href="mailto:support@6thultra.com">
          {' '}
          support@6thultra.com{' '}
        </a>
        for a manager review within 5 days.
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
