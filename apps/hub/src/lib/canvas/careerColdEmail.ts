/** Cold email & networking template builder — 100% client-side for Career Prep. */

export const CAREER_COLD_EMAIL_STORAGE_KEY = 'gsm-canvas-career:cold-email';

export interface ColdEmailInput {
  userName: string;
  targetRole: string;
  targetCompany: string;
  keySkills: string;
  yearsExperience: string;
  highlight: string;
}

export type ColdEmailTemplateId = 'cover' | 'linkedin' | 'cold';

export const DEFAULT_COLD_EMAIL_INPUT: ColdEmailInput = {
  userName: '',
  targetRole: '',
  targetCompany: '',
  keySkills: '',
  yearsExperience: '',
  highlight: '',
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
  };
}

export const COLD_EMAIL_TEMPLATE_META: { id: ColdEmailTemplateId; title: string }[] = [
  { id: 'cover', title: 'Formal cover letter' },
  { id: 'linkedin', title: 'LinkedIn connection note' },
  { id: 'cold', title: 'Cold email to hiring manager' },
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
