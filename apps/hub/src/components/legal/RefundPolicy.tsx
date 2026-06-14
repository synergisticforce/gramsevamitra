import LegalDocumentShell, { LegalSection } from './LegalDocumentShell';

const SUPPORT_EMAIL = 'support@gramsevamitra.in';

export default function RefundPolicy() {
  return (
    <LegalDocumentShell title="Refund & Cancellation Policy">
      <p>
        This Refund &amp; Cancellation Policy applies to paid Pro subscriptions for GramSeva Mitra,
        processed through Razorpay. Please read this policy carefully before purchasing.
      </p>

      <LegalSection title="1. Digital Service Nature">
        <p>
          GramSeva Mitra Pro is a <strong>digital subscription service</strong>. Upon successful payment,
          Pro features are activated immediately or within a short processing window. Because access to
          digital services begins promptly, <strong>refunds are generally not provided</strong> once a
          subscription period has started.
        </p>
      </LegalSection>

      <LegalSection title="2. No Refunds for Change of Mind">
        <p>
          We do not offer refunds for dissatisfaction with features, unused subscription time, accidental
          purchases after Pro access has been granted, or failure to cancel before a renewal charge. You
          may cancel future renewals at any time; cancellation prevents subsequent billing but does not
          retroactively refund the current period.
        </p>
      </LegalSection>

      <LegalSection title="3. Billing Errors">
        <p>
          If you believe a <strong>billing error</strong> occurred — such as duplicate charges, incorrect
          amounts, or charges after a confirmed cancellation — contact us within <strong>7 days</strong>{' '}
          of the transaction at{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-violet-700 underline">
            {SUPPORT_EMAIL}
          </a>{' '}
          with your registered email, payment date, and Razorpay payment ID. Verified billing errors will
          be corrected via refund to the original payment method or account credit, at our discretion,
          within 7–14 business days.
        </p>
      </LegalSection>

      <LegalSection title="4. Failed or Incomplete Activation">
        <p>
          If payment was debited but Pro access was not activated due to a technical fault on our side,
          we will either activate your subscription or issue a full refund after investigation. Please
          include proof of payment when contacting support.
        </p>
      </LegalSection>

      <LegalSection title="5. Cancellation">
        <p>
          You may cancel auto-renewal through account settings or by emailing{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-violet-700 underline">
            {SUPPORT_EMAIL}
          </a>
          . Cancellation takes effect at the end of the current paid billing cycle. No partial refunds are
          issued for unused days in an active period.
        </p>
      </LegalSection>

      <LegalSection title="6. Chargebacks">
        <p>
          Initiating an unjustified chargeback without contacting us first may result in suspension of
          your account. We encourage you to reach out to resolve billing concerns before disputing
          charges with your bank.
        </p>
      </LegalSection>

      <LegalSection title="7. Contact">
        <p>
          Refund and billing inquiries:{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-violet-700 underline">
            {SUPPORT_EMAIL}
          </a>
          . We aim to respond within 2 business days.
        </p>
      </LegalSection>
    </LegalDocumentShell>
  );
}
