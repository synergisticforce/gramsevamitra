export interface CoverLetterInput {
  userName: string;
  targetRole: string;
  companyName: string;
}

function val(raw: string, fallback: string): string {
  return raw.trim() || fallback;
}

export function buildCoverLetterText(input: CoverLetterInput): string {
  const name = val(input.userName, '[Your Name]');
  const role = val(input.targetRole, '[Target Role]');
  const company = val(input.companyName, '[Company Name]');

  return `Dear Hiring Manager,

I am writing to express my interest in the ${role} position at ${company}. I am confident that my background and skills align well with the requirements outlined in your job posting, and I would welcome the opportunity to contribute to your team.

Throughout my career, I have focused on delivering high-quality results, collaborating effectively with colleagues, and continuously improving my professional capabilities. I am particularly drawn to ${company}'s mission and believe my experience would allow me to add value from day one.

I have attached my resume for your review and would appreciate the chance to discuss how my qualifications match your needs. Thank you for considering my application.

Sincerely,
${name}`;
}

export function coverLetterDownloadName(companyName: string): string {
  const slug = companyName.trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 40);
  return slug ? `cover-letter-${slug}.txt` : 'cover-letter.txt';
}

export async function copyTextToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

export function downloadTextFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
