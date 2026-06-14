import type nlpType from 'compromise';

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as',
  'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'i', 'you', 'he', 'she', 'it', 'we',
  'they', 'this', 'that', 'these', 'those', 'if', 'because', 'until', 'while', 'about', 'into', 'through',
  'our', 'your', 'their', 'my', 'his', 'her', 'its', 'all', 'any', 'both', 'each', 'few', 'more', 'most',
  'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
  'also', 'now', 'etc', 'work', 'working', 'role', 'job', 'team', 'company', 'experience', 'years', 'year',
  'ability', 'required', 'preferred', 'strong', 'good', 'excellent', 'candidate', 'position', 'responsibilities',
  'qualifications', 'skills', 'skill', 'looking', 'join', 'us', 'we', 'well', 'using', 'use', 'used',
]);

export interface AtsScanResult {
  score: number;
  missingKeywords: string[];
  matchedCount: number;
  totalJobTerms: number;
  resumeWordCount: number;
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
    if (jdRoot.length >= 4 && resumeRoot.length >= 4) {
      if (resumeRoot.startsWith(jdRoot) || jdRoot.startsWith(resumeRoot)) return true;
    }
  }
  return false;
}

/** Compare resume text against a job description — 100% client-side. */
export async function analyzeAtsMatch(
  resumeText: string,
  jobDescription: string
): Promise<AtsScanResult> {
  if (!jobDescription.trim()) {
    throw new Error('Please paste a job description.');
  }
  if (!resumeText.trim()) {
    throw new Error('Resume text is empty. Upload a text-based PDF resume.');
  }

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

  const missingKeywords = [...jdFreq.entries()]
    .filter(([term]) => !resumeContainsRoot(resumeRoots, term))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([term]) => term);

  const score = Math.round((matched.length / jdRoots.length) * 100);
  const resumeWordCount = resumeText.split(/\s+/).filter(Boolean).length;

  return {
    score,
    missingKeywords,
    matchedCount: matched.length,
    totalJobTerms: jdRoots.length,
    resumeWordCount,
  };
}
