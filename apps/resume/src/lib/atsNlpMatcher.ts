import type nlpType from 'compromise';

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as',
  'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'i', 'you', 'he', 'she', 'it', 'we',
  'they', 'this', 'that', 'these', 'those', 'am', 'if', 'because', 'until', 'while', 'about', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under',
  'again', 'our', 'your', 'their', 'my', 'his', 'her', 'its', 'all', 'any', 'both', 'each', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'just', 'also', 'now', 'etc', 'who', 'whom', 'which', 'what', 'when', 'where', 'how', 'why',
  'work', 'working', 'role', 'job', 'team', 'company', 'experience', 'years', 'year', 'ability', 'able',
  'including', 'required', 'preferred', 'strong', 'good', 'excellent', 'candidate', 'position',
  'responsibilities', 'responsibility', 'qualifications', 'qualification', 'skills', 'skill', 'looking',
  'join', 'us', 'we', 'well', 'using', 'use', 'used', 'include', 'includes', 'within', 'across',
]);

const SOFT_SKILL_HINTS = new Set([
  'communication', 'leadership', 'teamwork', 'collaboration', 'adaptability', 'flexibility', 'creativity',
  'problem', 'solving', 'critical', 'thinking', 'interpersonal', 'negotiation', 'presentation', 'mentoring',
  'coaching', 'empathy', 'patience', 'organization', 'organizational', 'time', 'management', 'multitasking',
  'initiative', 'motivation', 'integrity', 'accountability', 'resilience', 'conflict', 'resolution',
  'emotional', 'intelligence', 'listening', 'writing', 'verbal', 'stakeholder', 'relationship',
]);

const HARD_SKILL_HINTS =
  /\b(python|java|javascript|typescript|react|node|sql|aws|azure|gcp|docker|kubernetes|linux|git|api|rest|graphql|excel|tableau|power\s*bi|sap|oracle|salesforce|figma|photoshop|cad|matlab|r\b|scala|go\b|rust|c\+\+|c#|\.net|php|ruby|swift|kotlin|html|css|mongodb|postgres|mysql|redis|kafka|spark|hadoop|tensorflow|pytorch|ml\b|ai\b|nlp\b|devops|ci\/cd|agile|scrum|jira|seo|sem|crm|erp|accounting|audit|tax|compliance|forecasting|modeling|statistics|research|analysis|analytics|engineering|design|development|testing|automation|cloud|security|network|database|data|software|hardware|embedded|firmware|mobile|ios|android|web\b|fullstack|backend|frontend|microservices|blockchain|excel|ppt|word)\b/i;

export interface FormattingWarning {
  type: 'success' | 'warning' | 'error';
  message: string;
}

export interface SkillBuckets {
  matched: string[];
  missing: string[];
}

export interface AtsMatchAnalysis {
  score: number;
  matched: string[];
  missing: string[];
  missingHighFrequency: string[];
  hardSkills: SkillBuckets;
  softSkills: SkillBuckets;
  formattingWarnings: FormattingWarning[];
  totalJdTerms: number;
  resumeWordCount: number;
  jobWordCount: number;
}

function cleanTerm(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^[^\w+#.-]+|[^\w+#.-]+$/g, '')
    .trim();
}

function isValidTerm(term: string): boolean {
  return term.length >= 2 && !STOP_WORDS.has(term) && !/^\d+$/.test(term);
}

function extractRootTerms(text: string, nlp: typeof nlpType): string[] {
  if (!text.trim()) return [];

  const doc = nlp(text);
  doc.verbs().toInfinitive();
  doc.nouns().toSingular();

  const nouns = doc.nouns().out('array') as string[];
  const verbs = doc.verbs().out('array') as string[];
  const topics = doc.topics().out('array') as string[];
  const technical =
    text.toLowerCase().match(/\b[a-z0-9]*[+#.][a-z0-9.+#-]+\b|\b[a-z]{2,}\+\+\b/g) ?? [];

  const seen = new Set<string>();
  const roots: string[] = [];

  const add = (raw: string) => {
    const term = cleanTerm(raw);
    if (!isValidTerm(term) || seen.has(term)) return;
    seen.add(term);
    roots.push(term);
  };

  nouns.forEach(add);
  verbs.forEach(add);
  topics.forEach(add);
  technical.forEach(add);

  return roots;
}

function countTermFrequency(text: string, nlp: typeof nlpType): Map<string, number> {
  const roots = extractRootTerms(text, nlp);
  const freq = new Map<string, number>();
  for (const term of roots) {
    freq.set(term, (freq.get(term) ?? 0) + 1);
  }
  return freq;
}

function resumeContainsRoot(resumeRoots: Set<string>, jdRoot: string): boolean {
  if (resumeRoots.has(jdRoot)) return true;
  for (const resumeRoot of resumeRoots) {
    if (resumeRoot === jdRoot) return true;
    if (jdRoot.length >= 4 && resumeRoot.length >= 4) {
      if (resumeRoot.startsWith(jdRoot) || jdRoot.startsWith(resumeRoot)) return true;
    }
  }
  return false;
}

function classifySkill(term: string): 'hard' | 'soft' | 'general' {
  if (SOFT_SKILL_HINTS.has(term) || term.includes('communication') || term.includes('leadership')) {
    return 'soft';
  }
  if (HARD_SKILL_HINTS.test(term)) return 'hard';
  if (/^[a-z]+\+\+$|^[a-z]+#|\.js$|\.net$/i.test(term)) return 'hard';
  return 'general';
}

function analyzeFormatting(resumeText: string): FormattingWarning[] {
  const warnings: FormattingWarning[] = [];
  const lower = resumeText.toLowerCase();
  const lines = resumeText.split('\n').map((l) => l.trim()).filter(Boolean);

  const sections = [
    { name: 'Contact information', patterns: [/email|phone|linkedin|@/i] },
    { name: 'Professional summary', patterns: [/summary|objective|profile|about/i] },
    { name: 'Work experience', patterns: [/experience|employment|work history/i] },
    { name: 'Education', patterns: [/education|degree|university|college|b\.?tech|mba/i] },
    { name: 'Skills section', patterns: [/skills|technical skills|competencies|technologies/i] },
  ];

  sections.forEach(({ name, patterns }) => {
    const found = patterns.some((p) => p.test(lower));
    warnings.push({
      type: found ? 'success' : 'warning',
      message: found
        ? `${name} detected — good for ATS section parsing`
        : `Add a clear "${name}" heading so ATS parsers can categorize content`,
    });
  });

  if (lines.length < 12) {
    warnings.push({
      type: 'warning',
      message: 'Resume text looks short — expand with quantified bullet points',
    });
  }

  if (/table|│|┌|└|<table/i.test(resumeText)) {
    warnings.push({
      type: 'error',
      message: 'Avoid tables and column layouts — many ATS systems cannot parse them reliably',
    });
  }

  if (resumeText.length > 0 && resumeText.split(/\s+/).length > 900) {
    warnings.push({
      type: 'warning',
      message: 'Resume may be too long — aim for 1–2 pages of scannable content for ATS',
    });
  }

  const fancyFonts = /font-family:\s*[^;]*(script|cursive|fantasy)/i.test(resumeText);
  if (fancyFonts) {
    warnings.push({
      type: 'error',
      message: 'Decorative fonts reduce ATS readability — use Arial, Calibri, or Helvetica',
    });
  }

  const hasMetrics = /\d+%|\d+\+|₹|\$|\d+\s*(years|yrs|months|lakhs|lakh|crore|k\b|m\b)/i.test(resumeText);
  warnings.push({
    type: hasMetrics ? 'success' : 'warning',
    message: hasMetrics
      ? 'Quantified achievements found — metrics strengthen ATS ranking'
      : 'Add measurable outcomes (%, revenue, time saved) to bullet points',
  });

  const bulletHeavy = (resumeText.match(/[•\-*]\s/g) ?? []).length >= 3;
  warnings.push({
    type: bulletHeavy ? 'success' : 'warning',
    message: bulletHeavy
      ? 'Bullet structure detected — scannable format for recruiters and ATS'
      : 'Use consistent bullet points (- or •) instead of dense paragraphs',
  });

  return warnings;
}

function bucketSkills(
  jdTerms: string[],
  resumeRoots: Set<string>
): { hard: SkillBuckets; soft: SkillBuckets } {
  const hard: SkillBuckets = { matched: [], missing: [] };
  const soft: SkillBuckets = { matched: [], missing: [] };

  for (const term of jdTerms) {
    const kind = classifySkill(term);
    if (kind === 'general') continue;
    const bucket = kind === 'hard' ? hard : soft;
    if (resumeContainsRoot(resumeRoots, term)) {
      bucket.matched.push(term);
    } else {
      bucket.missing.push(term);
    }
  }

  hard.matched.sort();
  hard.missing.sort();
  soft.matched.sort();
  soft.missing.sort();
  return { hard, soft };
}

export async function analyzeNlpMatch(
  resumeText: string,
  jobDescription: string
): Promise<AtsMatchAnalysis> {
  const { default: nlp } = await import('compromise');

  const jdFreq = countTermFrequency(jobDescription, nlp);
  const jdRoots = [...jdFreq.keys()];
  if (jdRoots.length === 0) {
    throw new Error('Could not extract keywords from the job description. Paste more detail.');
  }

  const resumeRoots = new Set(extractRootTerms(resumeText, nlp));
  const matched: string[] = [];
  const missing: string[] = [];

  for (const term of jdRoots) {
    if (resumeContainsRoot(resumeRoots, term)) {
      matched.push(term);
    } else {
      missing.push(term);
    }
  }

  const missingHighFrequency = [...jdFreq.entries()]
    .filter(([term]) => !resumeContainsRoot(resumeRoots, term))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([term]) => term);

  const score = Math.round((matched.length / jdRoots.length) * 100);
  const { hard, soft } = bucketSkills(jdRoots, resumeRoots);
  const formattingWarnings = analyzeFormatting(resumeText);

  const resumeWordCount = resumeText.split(/\s+/).filter(Boolean).length;
  const jobWordCount = jobDescription.split(/\s+/).filter(Boolean).length;

  return {
    score,
    matched,
    missing,
    missingHighFrequency,
    hardSkills: hard,
    softSkills: soft,
    formattingWarnings,
    totalJdTerms: jdRoots.length,
    resumeWordCount,
    jobWordCount,
  };
}

/** @deprecated Use AtsMatchAnalysis */
export type NlpMatchResult = Pick<
  AtsMatchAnalysis,
  'score' | 'matched' | 'missing' | 'totalJdTerms'
>;
