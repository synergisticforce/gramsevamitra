import nlp from 'compromise';

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has',
  'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
  'shall', 'can', 'need', 'dare', 'ought', 'used', 'i', 'you', 'he', 'she', 'it', 'we',
  'they', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is',
  'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do',
  'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as',
  'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between',
  'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up',
  'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once',
  'our', 'your', 'their', 'my', 'his', 'her', 'its', 'all', 'any', 'both', 'each', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
  'so', 'than', 'too', 'very', 'just', 'also', 'now', 'etc', 'able', 'work', 'working',
  'experience', 'years', 'year', 'role', 'team', 'using', 'use', 'used', 'including',
  'include', 'includes', 'within', 'across', 'well', 'strong', 'excellent', 'good',
  'new', 'make', 'made', 'help', 'ensure', 'provide', 'support', 'required', 'requirements',
]);

export interface KeywordMatch {
  keyword: string;
  count: number;
  importance: 'critical' | 'important' | 'optional';
}

export interface StructuralFeedback {
  type: 'success' | 'warning' | 'error';
  message: string;
}

export interface ATSAnalysisResult {
  score: number;
  matchedKeywords: KeywordMatch[];
  missingKeywords: KeywordMatch[];
  keywordDensity: number;
  structuralFeedback: StructuralFeedback[];
  resumeWordCount: number;
  jobWordCount: number;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s+#.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractKeywords(text: string): Map<string, number> {
  const normalized = normalizeText(text);
  const doc = nlp(normalized);
  const nouns = doc.nouns().out('array') as string[];
  const terms = doc.terms().out('array') as string[];

  const frequency = new Map<string, number>();

  const addTerm = (raw: string) => {
    const term = raw.trim().toLowerCase();
    if (term.length < 2 || STOP_WORDS.has(term) || /^\d+$/.test(term)) return;
    frequency.set(term, (frequency.get(term) ?? 0) + 1);
  };

  nouns.forEach(addTerm);
  terms.forEach(addTerm);

  const words = normalized.split(' ');
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w.includes('#') || /^[a-z0-9]+[+.#-][a-z0-9.+#-]+$/i.test(w)) {
      addTerm(w);
    }
    if (i < words.length - 1) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      if (
        !STOP_WORDS.has(words[i]) &&
        !STOP_WORDS.has(words[i + 1]) &&
        bigram.length >= 5
      ) {
        const count = frequency.get(bigram) ?? 0;
        if (count === 0) frequency.set(bigram, 1);
      }
    }
  }

  return frequency;
}

function rankJobKeywords(
  jobKeywords: Map<string, number>,
  resumeKeywords: Map<string, number>
): { matched: KeywordMatch[]; missing: KeywordMatch[] } {
  const sorted = [...jobKeywords.entries()].sort((a, b) => b[1] - a[1]);
  const matched: KeywordMatch[] = [];
  const missing: KeywordMatch[] = [];

  sorted.forEach(([keyword, count], index) => {
    const importance: KeywordMatch['importance'] =
      index < 8 ? 'critical' : index < 20 ? 'important' : 'optional';

    const resumeCount = resumeKeywords.get(keyword) ?? 0;
    const entry: KeywordMatch = { keyword, count, importance };

    if (resumeCount > 0) {
      matched.push({ ...entry, count: resumeCount });
    } else if (importance !== 'optional') {
      missing.push(entry);
    }
  });

  return { matched, missing };
}

function analyzeStructure(resumeText: string): StructuralFeedback[] {
  const feedback: StructuralFeedback[] = [];
  const lines = resumeText.split('\n').map((l) => l.trim()).filter(Boolean);
  const lower = resumeText.toLowerCase();

  const sections = [
    { name: 'contact information', patterns: [/email|phone|linkedin|@/i] },
    { name: 'professional summary', patterns: [/summary|objective|profile|about/i] },
    { name: 'work experience', patterns: [/experience|employment|work history|professional experience/i] },
    { name: 'education', patterns: [/education|degree|university|college|b\.?tech|b\.?a|m\.?ba/i] },
    { name: 'skills', patterns: [/skills|technical skills|core competencies|technologies/i] },
  ];

  sections.forEach(({ name, patterns }) => {
    const found = patterns.some((p) => p.test(lower));
    feedback.push({
      type: found ? 'success' : 'warning',
      message: found
        ? `✓ ${name.charAt(0).toUpperCase() + name.slice(1)} section detected`
        : `Add a clear "${name}" section for ATS parsing`,
    });
  });

  if (lines.length < 15) {
    feedback.push({
      type: 'warning',
      message: 'Resume appears short — expand with quantified achievements',
    });
  }

  if (/table|│|┌|└/.test(resumeText)) {
    feedback.push({
      type: 'error',
      message: 'Avoid tables and complex formatting — ATS systems struggle to parse them',
    });
  }

  if (/[^\x00-\x7F]/.test(resumeText.replace(/[•·–—]/g, ''))) {
    feedback.push({
      type: 'warning',
      message: 'Minimize special characters; use standard bullet points (- or •)',
    });
  }

  const hasMetrics = /\d+%|\d+\+|₹|\$|\d+\s*(years|yrs|months|lakhs|crore)/i.test(resumeText);
  feedback.push({
    type: hasMetrics ? 'success' : 'warning',
    message: hasMetrics
      ? '✓ Quantified achievements found — strong for ATS ranking'
      : 'Add numbers and metrics (%, years, revenue) to strengthen impact',
  });

  return feedback;
}

export function analyzeATSMatch(jobDescription: string, resumeText: string): ATSAnalysisResult {
  if (!jobDescription.trim()) {
    throw new Error('Please paste a job description.');
  }
  if (!resumeText.trim()) {
    throw new Error('Resume text is empty. Upload a valid PDF or DOCX file.');
  }

  const jobKeywords = extractKeywords(jobDescription);
  const resumeKeywords = extractKeywords(resumeText);

  const jobWords = normalizeText(jobDescription).split(' ').filter((w) => w.length > 2);
  const resumeWords = normalizeText(resumeText).split(' ').filter((w) => w.length > 2);

  const { matched, missing } = rankJobKeywords(jobKeywords, resumeKeywords);

  const criticalMissing = missing.filter((k) => k.importance === 'critical');
  const importantMissing = missing.filter((k) => k.importance === 'important');

  let score = 0;
  const totalJobTerms = Math.max(jobKeywords.size, 1);
  const matchRatio = matched.length / totalJobTerms;
  score += Math.min(matchRatio * 55, 55);

  const criticalTotal = Math.max(
    [...jobKeywords.entries()].filter((_, i) => i < 8).length,
    1
  );
  const criticalMatched = matched.filter((m) =>
    [...jobKeywords.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .some(([k]) => k === m.keyword)
  ).length;
  score += (criticalMatched / criticalTotal) * 30;

  const density = resumeWords.length > 0 ? (matched.length / resumeWords.length) * 100 : 0;
  score += Math.min(density * 3, 15);

  score = Math.round(Math.min(Math.max(score, 0), 100));

  if (criticalMissing.length > 3) {
    score = Math.min(score, 45);
  }

  const structuralFeedback = analyzeStructure(resumeText);

  return {
    score,
    matchedKeywords: matched.slice(0, 25),
    missingKeywords: [...criticalMissing, ...importantMissing].slice(0, 15),
    keywordDensity: Math.round(density * 10) / 10,
    structuralFeedback,
    resumeWordCount: resumeWords.length,
    jobWordCount: jobWords.length,
  };
}

export async function extractTextFromPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    const workerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
  }

  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pages.push(pageText);
  }

  return pages.join('\n\n');
}

export async function extractTextFromDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

export async function extractResumeText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const name = file.name.toLowerCase();

  if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
    return extractTextFromPdf(buffer);
  }

  if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  ) {
    return extractTextFromDocx(buffer);
  }

  throw new Error('Unsupported file format. Please upload PDF or DOCX.');
}
