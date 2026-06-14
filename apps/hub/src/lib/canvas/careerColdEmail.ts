/** Cold email & networking template builder — 100% client-side for Career Prep. */

export const CAREER_COLD_EMAIL_STORAGE_KEY = 'gsm-canvas-career:cold-email';

export interface ColdEmailInput {
  userName: string;
  targetRole: string;
  targetCompany: string;
  keySkills: string;
  yearsExperience: string;
  highlight: string;
  interviewerName: string;
  interviewDate: string;
}

export type ColdEmailTemplateId =
  | 'cover'
  | 'linkedin'
  | 'cold'
  | 'interview-followup'
  | 'thank-you';

export const DEFAULT_COLD_EMAIL_INPUT: ColdEmailInput = {
  userName: '',
  targetRole: '',
  targetCompany: '',
  keySkills: '',
  yearsExperience: '',
  highlight: '',
  interviewerName: '',
  interviewDate: '',
};

function val(raw: string, fallback: string): string {
  return raw.trim() || fallback;
}

function parseSkills(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function skillsPhrase(skills: string[]): string {
  if (skills.length === 0) return '[your key skills]';
  if (skills.length === 1) return skills[0];
  if (skills.length === 2) return `${skills[0]} and ${skills[1]}`;
  return `${skills.slice(0, -1).join(', ')}, and ${skills[skills.length - 1]}`;
}

export function buildColdEmailTemplates(state: ColdEmailInput): Record<ColdEmailTemplateId, string> {
  const name = val(state.userName, '[Your Name]');
  const role = val(state.targetRole, '[Target Role]');
  const company = val(state.targetCompany, '[Target Company]');
  const skills = skillsPhrase(parseSkills(state.keySkills));
  const years = val(state.yearsExperience, '[X]');
  const highlight = val(
    state.highlight,
    'delivering measurable outcomes for cross-functional teams'
  );
  const interviewer = val(state.interviewerName, 'Hiring Manager');
  const interviewDate = val(state.interviewDate, '[Interview Date]');

  return {
    cover: `Dear Hiring Manager,

I am writing to express my interest in the ${role} position at ${company}. With ${years} years of experience in ${skills}, I am confident I can contribute from day one.

A recent highlight: ${highlight}. I am particularly drawn to ${company}'s mission and would welcome the opportunity to bring my expertise in ${skills} to your organization.

I have attached my resume for your review and would appreciate the chance to discuss how my background aligns with your needs.

Sincerely,
${name}`,
    linkedin: `Hi — I'm ${name}, exploring ${role} opportunities at ${company}. I admire the work your team is doing and would love to connect.

My background includes ${skills} (${years} years), with a focus on ${highlight}. If you're open to it, I'd appreciate any advice on ${role} roles at ${company}.

Thanks for considering my request!`,
    cold: `Subject: ${role} opportunity at ${company} — ${name}

Dear Hiring Manager,

My name is ${name}, and I am reaching out regarding the ${role} opening at ${company}. I specialize in ${skills} and have spent ${years} years ${highlight}.

I would value 15 minutes to share how I've applied ${skills} in past projects and learn more about your team's priorities. I've attached my resume for reference.

Would you be available for a brief call this week or next?

Best regards,
${name}`,
    'interview-followup': `Subject: Following up on ${role} interview — ${name}

Dear ${interviewer},

Thank you again for taking the time to speak with me on ${interviewDate} about the ${role} position at ${company}. I enjoyed learning more about the team and how ${skills} contribute to your goals.

Since our conversation, I remain very interested in the role. A recent highlight from my background: ${highlight}. I would welcome the opportunity to discuss how I can add value in your next hiring stage.

Please let me know if you need any additional information from my side.

Best regards,
${name}`,
    'thank-you': `Subject: Thank you — ${role} interview at ${company}

Dear ${interviewer},

I wanted to express my sincere thanks for meeting with me on ${interviewDate} to discuss the ${role} opportunity at ${company}. I appreciated your insights into the team and the challenges you're solving.

Our conversation reinforced my enthusiasm for the role, especially given my experience in ${skills} over ${years} years. I am excited about the possibility of contributing to ${company}'s work on ${highlight}.

Thank you again for your time and consideration.

Warm regards,
${name}`,
  };
}

export const COLD_EMAIL_TEMPLATE_META: { id: ColdEmailTemplateId; title: string }[] = [
  { id: 'cover', title: 'Formal cover letter' },
  { id: 'linkedin', title: 'LinkedIn note' },
  { id: 'cold', title: 'Cold email' },
  { id: 'interview-followup', title: 'Interview follow-up' },
  { id: 'thank-you', title: 'Thank you note' },
];

export function loadColdEmailInput(): ColdEmailInput {
  if (typeof window === 'undefined') return { ...DEFAULT_COLD_EMAIL_INPUT };
  try {
    const raw = localStorage.getItem(CAREER_COLD_EMAIL_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_COLD_EMAIL_INPUT };
    return { ...DEFAULT_COLD_EMAIL_INPUT, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_COLD_EMAIL_INPUT };
  }
}

export function saveColdEmailInput(input: ColdEmailInput): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CAREER_COLD_EMAIL_STORAGE_KEY, JSON.stringify(input));
  } catch {
    /* ignore */
  }
}

export async function copyColdEmailText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
