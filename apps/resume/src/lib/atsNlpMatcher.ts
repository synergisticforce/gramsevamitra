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

export interface NlpMatchResult {
  score: number;
  matched: string[];
  missing: string[];
  totalJdTerms: number;
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

/** Extract lemmatized noun / verb / topic roots via compromise. */
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

/**
 * Compare job description vs résumé using compromise root-word normalization.
 * Score = matched JD roots / total JD roots × 100.
 */
export async function analyzeNlpMatch(
  resumeText: string,
  jobDescription: string
): Promise<NlpMatchResult> {
  const { default: nlp } = await import('compromise');

  const jdRoots = extractRootTerms(jobDescription, nlp);
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

  const score = Math.round((matched.length / jdRoots.length) * 100);

  return {
    score,
    matched,
    missing,
    totalJdTerms: jdRoots.length,
  };
}
