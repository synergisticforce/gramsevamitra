export const ATS_STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
  'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'them',
  'their', 'our', 'your', 'my', 'his', 'her', 'who', 'whom', 'which', 'what', 'where', 'when', 'why', 'how',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
  'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there', 'then',
  'once', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under',
  'again', 'further', 'any', 'work', 'working', 'role', 'job', 'team', 'company', 'experience', 'years',
  'year', 'ability', 'able', 'including', 'required', 'preferred', 'strong', 'good', 'excellent',
  'candidate', 'candidates', 'position', 'responsibilities', 'responsibility', 'qualifications',
  'qualification', 'skills', 'skill', 'looking', 'join', 'us', 'we', 'our', 'well', 'etc',
]);

export interface KeywordMatchResult {
  score: number;
  matched: MatchedKeyword[];
  missing: string[];
  jdKeywords: string[];
  resumeTokens: Set<string>;
}

export interface MatchedKeyword {
  keyword: string;
  matchType: 'exact' | 'fuzzy' | 'substring';
  matchedAs: string;
}

function normalizeToken(raw: string): string {
  return raw.toLowerCase().replace(/^-+|-+$/g, '').trim();
}

/** Extract meaningful tokens from résumé or JD text. */
export function extractKeywords(text: string, stopWords = ATS_STOP_WORDS): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9+#./\s-]/g, ' ')
    .split(/[\s,;/|•·]+/)
    .map(normalizeToken)
    .filter((t) => t.length >= 2 && !stopWords.has(t) && !/^\d+$/.test(t));

  return new Set(tokens);
}

/** Pull multi-word phrases common in JDs (e.g. "machine learning", "project management"). */
export function extractPhrases(text: string, stopWords = ATS_STOP_WORDS): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9+#./\s-]/g, ' ')
    .split(/\s+/)
    .map(normalizeToken)
    .filter((w) => w.length >= 2 && !stopWords.has(w));

  const phrases: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    if (bigram.length >= 5) phrases.push(bigram);
  }
  return [...new Set(phrases)];
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j];
      row[j] =
        a[i - 1] === b[j - 1]
          ? prev
          : 1 + Math.min(prev, row[j - 1], row[j]);
      prev = temp;
    }
  }
  return row[b.length];
}

function fuzzyFind(resumeTokens: Set<string>, keyword: string): string | null {
  const maxDist = keyword.length <= 4 ? 0 : keyword.length <= 7 ? 1 : 2;

  for (const token of resumeTokens) {
    if (token === keyword) return token;
    if (maxDist > 0 && levenshtein(token, keyword) <= maxDist) return token;
  }
  return null;
}

function substringFind(resumeText: string, keyword: string): boolean {
  return resumeText.toLowerCase().includes(keyword.toLowerCase());
}

/**
 * Compare résumé text against a job description.
 * Score = matched JD keywords / total JD keywords (exact + fuzzy + substring).
 */
export function matchResumeToJob(resumeText: string, jobDescription: string): KeywordMatchResult {
  const resumeTokens = extractKeywords(resumeText);
  const jdTokens = extractKeywords(jobDescription);
  const jdPhrases = extractPhrases(jobDescription);
  const jdKeywords = [...new Set([...jdTokens, ...jdPhrases])];

  if (jdKeywords.length === 0) {
    return { score: 0, matched: [], missing: [], jdKeywords: [], resumeTokens };
  }

  const matched: MatchedKeyword[] = [];
  const missing: string[] = [];
  const resumeLower = resumeText.toLowerCase();

  for (const keyword of jdKeywords) {
    if (resumeTokens.has(keyword)) {
      matched.push({ keyword, matchType: 'exact', matchedAs: keyword });
      continue;
    }

    const fuzzy = fuzzyFind(resumeTokens, keyword);
    if (fuzzy) {
      matched.push({ keyword, matchType: 'fuzzy', matchedAs: fuzzy });
      continue;
    }

    if (keyword.includes(' ') && substringFind(resumeLower, keyword)) {
      matched.push({ keyword, matchType: 'substring', matchedAs: keyword });
      continue;
    }

    if (substringFind(resumeLower, keyword)) {
      matched.push({ keyword, matchType: 'substring', matchedAs: keyword });
      continue;
    }

    missing.push(keyword);
  }

  const score = Math.round((matched.length / jdKeywords.length) * 100);
  missing.sort();
  matched.sort((a, b) => a.keyword.localeCompare(b.keyword));

  return { score, matched, missing, jdKeywords, resumeTokens };
}
