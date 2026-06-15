import LegalDocumentShell, { LegalSection } from './LegalDocumentShell';

const SUPPORT_EMAIL = 'support@gramsevamitra.in';

export default function TermsOfService() {
  return (
    <LegalDocumentShell title="Terms of Service">
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of GramSeva Mitra (the
        &quot;Service&quot;), operated from India. By accessing or using the Service, you agree to these
        Terms. If you do not agree, do not use the Service.
      </p>

      <LegalSection title="1. Service Description">
        <p>
          GramSeva Mitra provides browser-based utilities for documents, media, career preparation,
          finance calculations, and everyday tools. A free tier runs primarily on your device. An optional
          Pro subscription (currently ₹99/year or as displayed at checkout) unlocks server-assisted
          features subject to availability.
        </p>
      </LegalSection>

      <LegalSection title="2. Eligibility">
        <p>
          You must be at least 18 years of age, or the age of majority in your jurisdiction, to create an
          account or purchase a subscription. By using the Service, you represent that you meet this
          requirement.
        </p>
      </LegalSection>

      <LegalSection title="3. Accounts & Subscriptions">
        <p>
          You are responsible for maintaining the confidentiality of your account credentials. Pro
          subscriptions are billed in advance through Razorpay. Prices are shown in Indian Rupees (INR)
          and may include applicable taxes as required by law.
        </p>
        <p>
          Subscriptions renew automatically unless cancelled before the renewal date. You may cancel
          through your account settings or by contacting support. Cancellation stops future charges; access
          continues until the end of the current billing period.
        </p>
      </LegalSection>

      <LegalSection title="4. Acceptable Use">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Use the Service for unlawful purposes or in violation of Indian law</li>
          <li>Upload content you do not have the right to process</li>
          <li>Attempt to bypass security, rate limits, or Pro access controls</li>
          <li>Reverse engineer, scrape, or overload our infrastructure</li>
          <li>Resell or redistribute the Service without written permission</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Your Content">
        <p>
          You retain ownership of files and data you submit. You grant us a limited licence to process
          content solely to provide the Service — including temporary storage for Pro features. You are
          solely responsible for verifying outputs meet official requirements before submission to
          authorities, employers, or third parties.
        </p>
      </LegalSection>

      <LegalSection title="6. Disclaimers">
        <p>
          The Service is provided on an &quot;as is&quot; and &quot;as available&quot; basis without
          warranties of any kind, whether express or implied, including fitness for a particular purpose,
          accuracy of calculations, ATS scores, or uninterrupted availability. Tool outputs are
          indicative only and do not guarantee exam acceptance, document approval, or employment outcomes.
        </p>
      </LegalSection>

      <LegalSection title="7. Limitation of Liability">
        <p>
          To the maximum extent permitted under the laws of India, GramSeva Mitra and its operators shall
          not be liable for indirect, incidental, special, consequential, or punitive damages, or any loss
          of profits, data, or goodwill arising from your use of the Service.
        </p>
      </LegalSection>

      <LegalSection title="8. Governing Law">
        <p>
          These Terms are governed by the laws of India. Courts in India shall have exclusive jurisdiction
          over disputes, subject to applicable consumer protection remedies.
        </p>
      </LegalSection>

      <LegalSection title="9. Changes">
        <p>
          We may modify these Terms at any time. Updated Terms will be posted on this page. Your continued
          use after changes constitutes acceptance.
        </p>
      </LegalSection>

      <LegalSection title="10. Contact">
        <p>
          Questions about these Terms:{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-canvas-accent underline">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </LegalDocumentShell>
  );
}
