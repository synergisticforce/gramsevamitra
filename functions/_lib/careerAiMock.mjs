/** Mock LLM responses and limits for Pro Career AI (Phase 6.3). */

export const CAREER_AI_ACTIONS = new Set(['rewrite_resume', 'generate_cover_letter']);

export const MOCK_CAREER_AI_DELAY_MS = 3000;

export const MAX_RESUME_TEXT_CHARS = 80_000;

export function sanitizeResumeText(raw) {
  if (typeof raw !== 'string') return '';
  return raw.replace(/\0/g, '').trim().slice(0, MAX_RESUME_TEXT_CHARS);
}

function excerptFromResume(resumeText, maxWords = 12) {
  const words = resumeText.split(/\s+/).filter(Boolean).slice(0, maxWords);
  return words.length ? words.join(' ') : 'your professional background';
}

export function buildMockCareerAiResponse(action, resumeText) {
  const excerpt = excerptFromResume(resumeText);

  if (action === 'rewrite_resume') {
    return `Mock AI Optimized Resume — ATS-Friendly Rewrite

PROFESSIONAL SUMMARY
Results-driven professional with a proven track record in ${excerpt}. Skilled at translating complex requirements into measurable outcomes while collaborating across teams.

KEY ACHIEVEMENTS (Mock AI Bullet Points)
• Led cross-functional initiatives that improved operational efficiency by 28% within two quarters.
• Designed and delivered scalable solutions aligned with stakeholder priorities, reducing turnaround time by 35%.
• Mentored junior team members and established documentation standards adopted department-wide.
• Partnered with leadership to define KPIs, reporting cadence, and data-driven decision workflows.

CORE COMPETENCIES
Strategic Planning · Process Optimization · Stakeholder Communication · Technical Documentation · Agile Delivery

NOTE: This is a mock Pro AI response. Production will use Gemma 2 / Llama 3.x on Cloudflare Workers AI.`;
  }

  return `Dear Hiring Manager,

I am writing to express my strong interest in the opportunity aligned with my background in ${excerpt}. After reviewing the role requirements, I am confident my experience maps directly to the impact your team is seeking.

In my recent roles, I have consistently delivered high-quality outcomes by combining analytical rigor with clear communication. I am particularly motivated by environments that reward initiative, continuous learning, and collaborative problem-solving.

My resume highlights quantifiable results — including efficiency gains, process improvements, and successful project delivery — that I would be excited to bring to your organization. I welcome the chance to discuss how my skills can support your team's goals.

Thank you for your time and consideration.

Sincerely,
[Your Name]

— Mock AI Cover Letter (Pro) — Production pipeline will personalize from job posting context.`;
}

export function outputFilenameForAction(action) {
  if (action === 'rewrite_resume') {
    return 'ai-optimized-resume.txt';
  }
  return 'ai-cover-letter.txt';
}

export function titleForAction(action) {
  if (action === 'rewrite_resume') {
    return 'AI Resume Rewriter';
  }
  return 'AI Cover Letter';
}
