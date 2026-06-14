/** Skill gap analyzer — target roles, competencies, and local progress storage. */

export const CAREER_SKILL_GAP_STORAGE_KEY = 'gsm-canvas-career:skill-gap';

export interface SkillCompetency {
  id: string;
  label: string;
  resource: string;
}

export interface TargetRoleProfile {
  id: string;
  label: string;
  summary: string;
  competencies: SkillCompetency[];
}

export const TARGET_ROLE_PROFILES: TargetRoleProfile[] = [
  {
    id: 'frontend-developer',
    label: 'Frontend Developer',
    summary: 'Build accessible, performant web interfaces with modern JavaScript frameworks.',
    competencies: [
      { id: 'html-css', label: 'Semantic HTML & responsive CSS', resource: 'MDN — HTML & CSS learning path' },
      { id: 'javascript', label: 'Modern JavaScript (ES6+)', resource: 'javascript.info — core language guide' },
      { id: 'react', label: 'React components & hooks', resource: 'React.dev — official documentation' },
      { id: 'typescript', label: 'TypeScript for type-safe UI', resource: 'TypeScript handbook — basics' },
      { id: 'a11y', label: 'Web accessibility (WCAG)', resource: 'W3C WAI — quick reference' },
      { id: 'perf', label: 'Core Web Vitals & performance', resource: 'web.dev — performance section' },
      { id: 'git', label: 'Git workflow & code review', resource: 'Pro Git book — chapters 1–3' },
      { id: 'testing', label: 'Unit & component testing', resource: 'Vitest / Testing Library docs' },
    ],
  },
  {
    id: 'data-analyst',
    label: 'Data Analyst',
    summary: 'Turn raw data into actionable insights with SQL, spreadsheets, and visualization.',
    competencies: [
      { id: 'sql', label: 'SQL queries & joins', resource: 'SQLBolt — interactive tutorials' },
      { id: 'excel', label: 'Excel / Sheets pivot tables', resource: 'Google Sheets function list' },
      { id: 'python', label: 'Python for data (pandas)', resource: 'Kaggle — Python & pandas micro-course' },
      { id: 'viz', label: 'Data visualization principles', resource: 'Storytelling with Data — blog' },
      { id: 'stats', label: 'Descriptive statistics', resource: 'Khan Academy — statistics unit' },
      { id: 'bi', label: 'BI tools (Power BI / Looker)', resource: 'Microsoft Learn — Power BI fundamentals' },
      { id: 'storytelling', label: 'Insight storytelling for stakeholders', resource: 'Harvard Business Review — data presentation' },
      { id: 'domain', label: 'Business domain knowledge', resource: 'Industry reports & case studies' },
    ],
  },
  {
    id: 'software-engineer',
    label: 'Software Engineer',
    summary: 'Design, build, and maintain reliable software systems end to end.',
    competencies: [
      { id: 'dsa', label: 'Data structures & algorithms', resource: 'NeetCode / LeetCode patterns list' },
      { id: 'oop', label: 'OOP & design principles', resource: 'Refactoring.Guru — design patterns' },
      { id: 'api', label: 'REST API design', resource: 'REST API tutorial — HTTP methods & status codes' },
      { id: 'db', label: 'Relational databases', resource: 'PostgreSQL tutorial — SQL & indexing' },
      { id: 'testing', label: 'Automated testing', resource: 'Test-Driven Development by Example (Kent Beck)' },
      { id: 'ci', label: 'CI/CD basics', resource: 'GitHub Actions — workflow documentation' },
      { id: 'cloud', label: 'Cloud fundamentals', resource: 'AWS Cloud Practitioner — free digital training' },
      { id: 'debug', label: 'Debugging & observability', resource: 'OpenTelemetry — getting started' },
    ],
  },
  {
    id: 'product-manager',
    label: 'Product Manager',
    summary: 'Define product vision, prioritize roadmaps, and ship customer value.',
    competencies: [
      { id: 'discovery', label: 'User discovery & interviews', resource: 'The Mom Test — customer interview framework' },
      { id: 'roadmap', label: 'Roadmap prioritization (RICE/ICE)', resource: 'ProductPlan — prioritization guides' },
      { id: 'metrics', label: 'Product metrics & KPIs', resource: 'Amplitude — product analytics playbook' },
      { id: 'prd', label: 'Writing PRDs & user stories', resource: 'Atlassian — agile user stories guide' },
      { id: 'stakeholder', label: 'Stakeholder communication', resource: 'Crucial Conversations — summary notes' },
      { id: 'wireframe', label: 'Wireframing & prototyping', resource: 'Figma Learn — design basics' },
      { id: 'agile', label: 'Agile / Scrum ceremonies', resource: 'Scrum Guide — official PDF' },
      { id: 'market', label: 'Competitive & market analysis', resource: 'Gartner / industry analyst reports' },
    ],
  },
  {
    id: 'ux-designer',
    label: 'UX Designer',
    summary: 'Research user needs and craft intuitive, research-backed product experiences.',
    competencies: [
      { id: 'research', label: 'User research methods', resource: 'NN/g — usability testing articles' },
      { id: 'ia', label: 'Information architecture', resource: 'UX Booth — IA fundamentals' },
      { id: 'wireframe', label: 'Wireframes & user flows', resource: 'Figma — wireframe kit tutorials' },
      { id: 'visual', label: 'Visual design & typography', resource: 'Refactoring UI — tips summary' },
      { id: 'prototype', label: 'Interactive prototyping', resource: 'Figma — prototyping docs' },
      { id: 'a11y', label: 'Inclusive design', resource: 'Microsoft Inclusive Design toolkit' },
      { id: 'handoff', label: 'Design-to-dev handoff', resource: 'Design systems — Storybook docs' },
      { id: 'portfolio', label: 'Case study portfolio', resource: 'Bestfolios — UX case study examples' },
    ],
  },
];

export interface SkillGapProgress {
  roleId: string;
  completedIds: string[];
}

export function loadSkillGapProgress(): SkillGapProgress {
  if (typeof window === 'undefined') {
    return { roleId: TARGET_ROLE_PROFILES[0].id, completedIds: [] };
  }
  try {
    const raw = localStorage.getItem(CAREER_SKILL_GAP_STORAGE_KEY);
    if (!raw) return { roleId: TARGET_ROLE_PROFILES[0].id, completedIds: [] };
    const parsed = JSON.parse(raw) as Partial<SkillGapProgress>;
    return {
      roleId: parsed.roleId ?? TARGET_ROLE_PROFILES[0].id,
      completedIds: Array.isArray(parsed.completedIds) ? parsed.completedIds.map(String) : [],
    };
  } catch {
    return { roleId: TARGET_ROLE_PROFILES[0].id, completedIds: [] };
  }
}

export function saveSkillGapProgress(progress: SkillGapProgress): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CAREER_SKILL_GAP_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}

export function getRoleProfile(roleId: string): TargetRoleProfile | undefined {
  return TARGET_ROLE_PROFILES.find((r) => r.id === roleId);
}

export function computeSkillGapStats(roleId: string, completedIds: string[]): {
  total: number;
  completed: number;
  percent: number;
} {
  const profile = getRoleProfile(roleId);
  if (!profile) return { total: 0, completed: 0, percent: 0 };
  const total = profile.competencies.length;
  const completed = profile.competencies.filter((c) => completedIds.includes(c.id)).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, percent };
}
