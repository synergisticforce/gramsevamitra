import LegalDocumentShell, { LegalSection } from './LegalDocumentShell';

const SUPPORT_EMAIL = 'support@gramsevamitra.in';

export default function PrivacyPolicy() {
  return (
    <LegalDocumentShell title="Privacy Policy">
      <p>
        GramSeva Mitra (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates the GramSeva Mitra web
        application at gramsevamitra.com and related subdomains (the &quot;Service&quot;). This Privacy
        Policy explains how we handle information when you use our free utilities and optional Pro
        subscription features. We are committed to compliance with applicable Indian data protection
        principles and global privacy best practices.
      </p>

      <LegalSection title="1. Overview">
        <p>
          GramSeva Mitra is designed with privacy first. Most free tools run entirely in your browser —
          your files and inputs are not uploaded to our servers for processing. When you subscribe to
          Pro, limited data may be transmitted securely to enable server-assisted features as described
          below.
        </p>
      </LegalSection>

      <LegalSection title="2. Information We Collect">
        <p>
          <strong>Account information:</strong> If you sign in (e.g., via Google OAuth), we store your
          name, email address, and authentication identifiers in our Cloudflare D1 database to manage
          your session and subscription status.
        </p>
        <p>
          <strong>Payment information:</strong> Pro subscriptions are processed by Razorpay. We do not
          store your full card or UPI credentials. Razorpay provides us with transaction references,
          payment status, and billing metadata required for subscription management.
        </p>
        <p>
          <strong>Pro processing data:</strong> For certain Pro features, files or extracted text may be
          temporarily stored in encrypted object storage (Cloudflare R2) for the duration of processing
          and deleted thereafter in accordance with our retention policy.
        </p>
        <p>
          <strong>Technical logs:</strong> Our hosting provider (Cloudflare) may record standard request
          metadata such as IP address, browser type, and timestamps for security, abuse prevention, and
          performance monitoring.
        </p>
        <p>
          <strong>Local storage:</strong> Free-tier workspace tools may save preferences and form inputs
          in your browser&apos;s <code className="rounded bg-slate-100 px-1">localStorage</code> on your
          device only. You may clear this data at any time through browser settings.
        </p>
      </LegalSection>

      <LegalSection title="3. How We Use Information">
        <ul className="list-disc space-y-2 pl-5">
          <li>To provide, maintain, and improve the Service</li>
          <li>To authenticate users and manage Pro subscriptions</li>
          <li>To process payments and respond to billing inquiries</li>
          <li>To detect fraud, abuse, and security incidents</li>
          <li>To comply with legal obligations in India</li>
        </ul>
        <p>We do not sell your personal information to third parties.</p>
      </LegalSection>

      <LegalSection title="4. Data Retention">
        <p>
          Account and subscription records are retained while your account is active and as required for
          tax, accounting, and legal compliance. Transient Pro uploads are deleted after processing,
          typically within one hour. Local browser data remains on your device until you clear it.
        </p>
      </LegalSection>

      <LegalSection title="5. Your Rights">
        <p>
          You may request access, correction, or deletion of account data we hold by contacting us at{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-violet-700 underline">
            {SUPPORT_EMAIL}
          </a>
          . We will respond within a reasonable timeframe as required by applicable law.
        </p>
      </LegalSection>

      <LegalSection title="6. Cookies & Third Parties">
        <p>
          We use essential cookies and similar technologies for authentication and session management.
          Payment processing is handled by Razorpay under their privacy policy. Sign-in may use Google
          OAuth subject to Google&apos;s terms.
        </p>
      </LegalSection>

      <LegalSection title="7. Changes">
        <p>
          We may update this Privacy Policy from time to time. Material changes will be reflected on this
          page with an updated &quot;Last updated&quot; date. Continued use of the Service after changes
          constitutes acceptance.
        </p>
      </LegalSection>

      <LegalSection title="8. Contact">
        <p>
          For privacy-related questions, email{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-violet-700 underline">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </LegalDocumentShell>
  );
}
