import { useCallback, useState } from 'react';
import { extractResumeText, isSupportedResumeFile } from '../lib/resumeTextExtract';
import { toProcessingError } from '../lib/processingErrors';

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as',
  'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'i', 'you', 'he', 'she', 'it', 'we',
  'they', 'this', 'that', 'these', 'those', 'am', 'if', 'because', 'until', 'while', 'about', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under',
  'again', 'our', 'your', 'their', 'my', 'his', 'her', 'its', 'all', 'any', 'both', 'each', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'just', 'also', 'now', 'etc', 'who', 'whom', 'which', 'what', 'when', 'where', 'how', 'why',
]);

const ACCEPT =
  'application/pdf,.pdf,image/jpeg,image/png,image/jpg,image/heic,image/heif,.heic,.heif,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s+#.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTokens(text: string): string[] {
  return normalizeText(text)
    .split(' ')
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

function extractTargetKeywords(jobText: string): string[] {
  const tokens = extractTokens(jobText);
  const seen = new Set<string>();
  const keywords: string[] = [];

  for (const token of tokens) {
    if (!seen.has(token)) {
      seen.add(token);
      keywords.push(token);
    }
  }

  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = `${tokens[i]} ${tokens[i + 1]}`;
    if (bigram.length >= 5 && !seen.has(bigram)) {
      seen.add(bigram);
      keywords.push(bigram);
    }
  }

  return keywords;
}

function analyzeMatch(
  resumeText: string,
  jobText: string
): { score: number; matched: string[]; missing: string[] } {
  const targetKeywords = extractTargetKeywords(jobText);
  if (targetKeywords.length === 0) {
    throw new Error('Could not extract keywords from the job description. Paste more detail.');
  }

  const resumeNormalized = normalizeText(resumeText);
  const resumeTokenSet = new Set(extractTokens(resumeText));
  const matched: string[] = [];
  const missing: string[] = [];

  for (const keyword of targetKeywords) {
    const found =
      resumeTokenSet.has(keyword) ||
      (keyword.includes(' ') && resumeNormalized.includes(keyword)) ||
      resumeNormalized.includes(keyword);

    if (found) matched.push(keyword);
    else missing.push(keyword);
  }

  const score = Math.round((matched.length / targetKeywords.length) * 100);
  return { score, matched, missing };
}

function scoreColor(score: number): string {
  if (score >= 75) return '#34d399';
  if (score >= 50) return '#fbbf24';
  if (score >= 30) return '#fb923c';
  return '#f87171';
}

export default function AtsResumeScannerTool() {
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [jobText, setJobText] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusLabel, setStatusLabel] = useState('Extracting resume text…');
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{
    score: number;
    matched: string[];
    missing: string[];
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const loadFile = useCallback((file: File) => {
    setError(null);
    setResults(null);
    if (!isSupportedResumeFile(file)) {
      setError('Please upload a PDF, DOCX, JPG, PNG, or HEIC resume.');
      return;
    }
    setCurrentFile(file);
  }, []);

  const scanResume = useCallback(async () => {
    setError(null);

    if (!currentFile) {
      setError('Upload your resume first.');
      return;
    }

    const trimmedJob = jobText.trim();
    if (!trimmedJob) {
      setError('Paste the job description to scan against.');
      return;
    }

    setBusy(true);
    setStatusLabel('Reading digital text...');

    try {
      const resumeText = await extractResumeText(currentFile, setStatusLabel);

      if (!resumeText.trim()) {
        setError('No text could be extracted. Try a clearer scan or a text-based document.');
        return;
      }

      setStatusLabel('Analyzing keywords…');
      const analysis = analyzeMatch(resumeText, trimmedJob);
      setResults(analysis);
    } catch (err) {
      setError(toProcessingError(err));
      setResults(null);
    } finally {
      setBusy(false);
    }
  }, [currentFile, jobText]);

  const gaugeOffset = results ? 283 - (results.score / 100) * 283 : 283;

  return (
    <div className="relative">
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <div className="space-y-5">
          <div
            role="button"
            tabIndex={0}
            onClick={() => document.getElementById('resume-file-input')?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                document.getElementById('resume-file-input')?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) loadFile(file);
            }}
            className={`cursor-pointer rounded-2xl border-2 border-dashed bg-gradient-to-br from-emerald-950/40 to-slate-900/60 px-4 py-8 text-center transition focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-950 ${
              dragOver
                ? 'border-emerald-400 bg-emerald-950/60 ring-2 ring-emerald-400/40'
                : 'border-emerald-700/50 hover:border-emerald-500 hover:bg-emerald-950/50'
            }`}
            aria-label="Drop your resume here or click to browse"
          >
            <input
              id="resume-file-input"
              type="file"
              accept={ACCEPT}
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) loadFile(file);
              }}
            />
            <span className="text-4xl" aria-hidden="true">
              📄
            </span>
            <p className="mt-3 text-base font-bold text-white">Drop your resume</p>
            <p className="mt-1 text-sm text-slate-400">PDF, DOCX, JPG, PNG, or HEIC</p>
          </div>

          {currentFile && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
              <p className="truncate text-sm font-semibold text-white">{currentFile.name}</p>
              <p className="text-xs text-slate-500">{formatSize(currentFile.size)}</p>
              <button
                type="button"
                onClick={() => {
                  setCurrentFile(null);
                  setResults(null);
                  setError(null);
                }}
                className="btn-secondary mt-2 w-full text-xs"
              >
                Choose a different file
              </button>
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-300">Job description</span>
            <textarea
              rows={14}
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              disabled={busy}
              className="input-field w-full resize-y text-sm leading-relaxed"
              placeholder="Paste the full job description here — requirements, skills, qualifications…"
            />
          </label>

          {error && (
            <p className="text-sm text-rose-400" role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={() => void scanResume()}
            disabled={busy}
            className="btn-primary w-full py-3 text-base font-bold disabled:opacity-60"
          >
            {busy ? 'Scanning…' : 'Scan Resume'}
          </button>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-white">Match Results</h2>
          <p className="mt-1 text-xs text-slate-500">
            Keyword overlap between your resume and the job description
          </p>

          {!results ? (
            <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-16 text-center">
              <span className="text-4xl opacity-40" aria-hidden="true">
                🎯
              </span>
              <p className="mt-4 text-sm text-slate-500">
                Upload a resume and paste a job description, then click{' '}
                <strong className="text-slate-400">Scan Resume</strong> to see your match score.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              <div className="flex flex-col items-center gap-4 rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-6">
                <div className="relative h-40 w-40" aria-hidden="true">
                  <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#1e293b" strokeWidth="8" />
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke={scoreColor(results.score)}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray="283"
                      strokeDashoffset={gaugeOffset}
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold text-white">{results.score}</span>
                    <span className="text-xs text-slate-400">Match Score</span>
                  </div>
                </div>
                <p className="text-center text-sm text-slate-400">
                  {results.matched.length} of {results.matched.length + results.missing.length} job
                  keywords found in your resume
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-300">
                  Matched Keywords
                </h3>
                {results.matched.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">No matching keywords found.</p>
                ) : (
                  <ul className="mt-3 flex flex-wrap gap-2" aria-label="Matched keywords">
                    {results.matched.map((kw) => (
                      <li
                        key={kw}
                        className="rounded-full bg-emerald-950/60 px-3 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-800"
                      >
                        {kw}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-rose-300">
                  Missing Keywords
                </h3>
                {results.missing.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    All target keywords were found in your resume.
                  </p>
                ) : (
                  <ul className="mt-3 flex flex-wrap gap-2" aria-label="Missing keywords">
                    {results.missing.map((kw) => (
                      <li
                        key={kw}
                        className="rounded-full bg-rose-950/60 px-3 py-1 text-xs font-medium text-rose-300 ring-1 ring-rose-800"
                      >
                        {kw}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {busy && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-800/50 bg-slate-900/95 px-8 py-6 shadow-2xl">
            <div
              className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-400"
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-emerald-300">{statusLabel}</p>
          </div>
        </div>
      )}
    </div>
  );
}
