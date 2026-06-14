/** Legal & employment plain-text templates — client-side fill-in for Career Prep. */

export const CAREER_LEGAL_TEMPLATES_STORAGE_KEY = 'gsm-canvas-career:legal-templates';

export type LegalTemplateId = 'nda' | 'offer-letter' | 'freelance-agreement';

export interface LegalTemplateField {
  key: string;
  label: string;
  placeholder: string;
  multiline?: boolean;
}

export interface LegalTemplateDef {
  id: LegalTemplateId;
  label: string;
  description: string;
  disclaimer: string;
  fields: LegalTemplateField[];
}

export const LEGAL_TEMPLATE_DEFS: LegalTemplateDef[] = [
  {
    id: 'nda',
    label: 'Non-Disclosure Agreement (NDA)',
    description: 'Basic mutual confidentiality agreement for interviews or freelance discussions.',
    disclaimer:
      'Draft template only — not legal advice. Have a qualified lawyer review before signing.',
    fields: [
      { key: 'partyA', label: 'Party A (Disclosing)', placeholder: 'Acme Pvt Ltd' },
      { key: 'partyB', label: 'Party B (Receiving)', placeholder: 'Your Name / Company' },
      { key: 'purpose', label: 'Purpose of disclosure', placeholder: 'Job interview / project evaluation' },
      { key: 'termYears', label: 'Confidentiality term (years)', placeholder: '2' },
      { key: 'jurisdiction', label: 'Governing law / jurisdiction', placeholder: 'Bangalore, Karnataka, India' },
      { key: 'effectiveDate', label: 'Effective date', placeholder: '1 January 2026' },
    ],
  },
  {
    id: 'offer-letter',
    label: 'Employment Offer Letter',
    description: 'Simple offer letter outline for full-time employment.',
    disclaimer:
      'Draft template only — not legal advice. Customize with HR/legal counsel for your organization.',
    fields: [
      { key: 'candidateName', label: 'Candidate name', placeholder: 'Priya Sharma' },
      { key: 'companyName', label: 'Company name', placeholder: 'GramSeva Mitra Pvt Ltd' },
      { key: 'role', label: 'Job title', placeholder: 'Software Engineer' },
      { key: 'startDate', label: 'Start date', placeholder: '15 March 2026' },
      { key: 'ctc', label: 'Annual CTC (₹)', placeholder: '12,00,000' },
      { key: 'location', label: 'Work location', placeholder: 'Bangalore (hybrid)' },
      { key: 'reportingTo', label: 'Reporting manager', placeholder: 'Head of Engineering' },
      { key: 'offerDate', label: 'Offer date', placeholder: '1 March 2026' },
    ],
  },
  {
    id: 'freelance-agreement',
    label: 'Freelance Services Agreement',
    description: 'Independent contractor agreement for project-based work.',
    disclaimer:
      'Draft template only — not legal advice. Consult a lawyer for tax, IP, and liability clauses.',
    fields: [
      { key: 'clientName', label: 'Client name', placeholder: 'Acme Corp' },
      { key: 'contractorName', label: 'Contractor name', placeholder: 'Your Name' },
      { key: 'projectScope', label: 'Project scope', placeholder: 'Build a responsive marketing landing page', multiline: true },
      { key: 'fee', label: 'Total fee (₹)', placeholder: '75,000' },
      { key: 'timeline', label: 'Timeline / milestones', placeholder: '4 weeks from signing' },
      { key: 'paymentTerms', label: 'Payment terms', placeholder: '50% upfront, 50% on delivery' },
      { key: 'jurisdiction', label: 'Governing law / jurisdiction', placeholder: 'Delhi NCR, India' },
      { key: 'effectiveDate', label: 'Effective date', placeholder: '1 April 2026' },
    ],
  },
];

export type LegalTemplateValues = Record<string, string>;

function v(values: LegalTemplateValues, key: string, fallback: string): string {
  return values[key]?.trim() || fallback;
}

export function buildLegalTemplateText(
  templateId: LegalTemplateId,
  values: LegalTemplateValues
): string {
  if (templateId === 'nda') {
    const partyA = v(values, 'partyA', '[Party A]');
    const partyB = v(values, 'partyB', '[Party B]');
    const purpose = v(values, 'purpose', '[Purpose]');
    const termYears = v(values, 'termYears', '2');
    const jurisdiction = v(values, 'jurisdiction', '[Jurisdiction]');
    const effectiveDate = v(values, 'effectiveDate', '[Effective Date]');

    return `MUTUAL NON-DISCLOSURE AGREEMENT

Effective Date: ${effectiveDate}

This Mutual Non-Disclosure Agreement ("Agreement") is entered into by and between:

1. ${partyA} ("Party A")
2. ${partyB} ("Party B")

(collectively, the "Parties")

1. PURPOSE
The Parties wish to explore: ${purpose}. In connection with this purpose, each Party may disclose certain confidential information to the other.

2. CONFIDENTIAL INFORMATION
"Confidential Information" means any non-public business, technical, financial, or proprietary information disclosed by either Party, whether oral, written, or electronic, that is marked or reasonably understood to be confidential.

3. OBLIGATIONS
Each Party agrees to:
(a) use Confidential Information solely for the Purpose stated above;
(b) not disclose Confidential Information to third parties without prior written consent;
(c) protect Confidential Information with at least the same degree of care it uses for its own confidential information.

4. TERM
This Agreement remains in effect for ${termYears} year(s) from the Effective Date. Confidentiality obligations survive termination.

5. GOVERNING LAW
This Agreement is governed by the laws of ${jurisdiction}.

6. ENTIRE AGREEMENT
This document constitutes the entire agreement regarding confidentiality for the stated Purpose.

_________________________          _________________________
${partyA}                          ${partyB}
Date: _______________              Date: _______________`;
  }

  if (templateId === 'offer-letter') {
    const candidateName = v(values, 'candidateName', '[Candidate Name]');
    const companyName = v(values, 'companyName', '[Company Name]');
    const role = v(values, 'role', '[Job Title]');
    const startDate = v(values, 'startDate', '[Start Date]');
    const ctc = v(values, 'ctc', '[CTC Amount]');
    const location = v(values, 'location', '[Location]');
    const reportingTo = v(values, 'reportingTo', '[Reporting Manager]');
    const offerDate = v(values, 'offerDate', '[Offer Date]');

    return `EMPLOYMENT OFFER LETTER

Date: ${offerDate}

Dear ${candidateName},

We are pleased to offer you the position of ${role} at ${companyName}, subject to the terms below.

POSITION & REPORTING
• Job Title: ${role}
• Reporting To: ${reportingTo}
• Work Location: ${location}
• Date of Joining: ${startDate}

COMPENSATION
• Annual Cost to Company (CTC): ₹${ctc} (Rupees ${ctc} only), subject to applicable statutory deductions and company policies.

EMPLOYMENT TERMS
• This is a full-time employment offer contingent upon satisfactory background verification and submission of required documents.
• You will be governed by ${companyName}'s employee handbook, code of conduct, and HR policies as amended from time to time.
• Either party may terminate employment as per company notice policy and applicable labour laws.

ACCEPTANCE
Please sign and return a copy of this letter by __________ to confirm your acceptance.

We look forward to welcoming you to the team.

Sincerely,

_________________________
Authorized Signatory
${companyName}

Accepted by:

_________________________
${candidateName}
Date: _______________`;
  }

  const clientName = v(values, 'clientName', '[Client Name]');
  const contractorName = v(values, 'contractorName', '[Contractor Name]');
  const projectScope = v(values, 'projectScope', '[Project Scope]');
  const fee = v(values, 'fee', '[Fee Amount]');
  const timeline = v(values, 'timeline', '[Timeline]');
  const paymentTerms = v(values, 'paymentTerms', '[Payment Terms]');
  const jurisdiction = v(values, 'jurisdiction', '[Jurisdiction]');
  const effectiveDate = v(values, 'effectiveDate', '[Effective Date]');

  return `FREELANCE SERVICES AGREEMENT

Effective Date: ${effectiveDate}

This Freelance Services Agreement ("Agreement") is between:

• Client: ${clientName}
• Contractor: ${contractorName} (an independent contractor, not an employee)

1. SERVICES
Contractor agrees to perform the following services ("Services"):
${projectScope}

2. TIMELINE
Services shall be completed within: ${timeline}, unless extended in writing by both Parties.

3. COMPENSATION
Total fee for Services: ₹${fee} (Rupees ${fee} only).
Payment terms: ${paymentTerms}.

4. INDEPENDENT CONTRACTOR
Contractor is an independent contractor responsible for their own taxes, insurance, and equipment. Nothing in this Agreement creates an employer-employee relationship.

5. INTELLECTUAL PROPERTY
Upon full payment, deliverables created specifically for the Client under this Agreement shall be assigned to the Client, unless otherwise agreed in writing.

6. CONFIDENTIALITY
Contractor shall not disclose Client confidential information without prior written consent.

7. GOVERNING LAW
This Agreement is governed by the laws of ${jurisdiction}.

8. ENTIRE AGREEMENT
This document constitutes the entire agreement between the Parties for the Services described.

_________________________          _________________________
${clientName} (Client)              ${contractorName} (Contractor)
Date: _______________              Date: _______________`;
}

export function getLegalTemplateDef(id: LegalTemplateId): LegalTemplateDef | undefined {
  return LEGAL_TEMPLATE_DEFS.find((t) => t.id === id);
}

export function loadLegalTemplateState(): {
  templateId: LegalTemplateId;
  values: LegalTemplateValues;
} {
  const fallback = { templateId: 'nda' as LegalTemplateId, values: {} as LegalTemplateValues };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(CAREER_LEGAL_TEMPLATES_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { templateId?: LegalTemplateId; values?: LegalTemplateValues };
    return {
      templateId: parsed.templateId ?? 'nda',
      values: parsed.values ?? {},
    };
  } catch {
    return fallback;
  }
}

export function saveLegalTemplateState(templateId: LegalTemplateId, values: LegalTemplateValues): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CAREER_LEGAL_TEMPLATES_STORAGE_KEY, JSON.stringify({ templateId, values }));
  } catch {
    /* ignore */
  }
}

export async function copyLegalTemplateText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
