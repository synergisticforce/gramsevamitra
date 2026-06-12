import { useCallback, useState } from 'react';
import { analyzeNlpMatch, type AtsMatchAnalysis, type FormattingWarning } from '../lib/atsNlpMatcher';
import { extractResumeText, isSupportedResumeFile } from '../lib/resumeTextExtract';
import { toProcessingError } from '../lib/processingErrors';

const ACCEPT =
  'application/pdf,.pdf,image/jpeg,image/png,image/jpg,image/heic,image/heif,.heic,.heif,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,text/plain,.txt';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function scoreColor(score: number): string {
  if (score >= 75) return '#34d399';
  if (score >= 50) return '#fbbf24';
  if (score >= 30) return '#fb923c';
  return '#f87171';
}

function warningClass(type: FormattingWarning['type']): string {
  if (type === 'success') return 'border-emerald-800/50 bg-emerald-950/30 text-emerald-200';
  if (type === 'error') return 'border-rose-800/50 bg-rose-950/30 text-rose-200';
  return 'border-amber-800/50 bg-amber-950/30 text-amber-100';
}

function SkillList({ title, matched, missing, matchedClass, missingClass }: {
  title: string;
  matched: string[];
  missing: string[];
  matchedClass: string;
  missingClass: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Matched ({matched.length})</p>
          {matched.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">None detected yet.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {matched.map((kw) => (
                <li key={kw} className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${matchedClass}`}>
                  {kw}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Gaps ({missing.length})</p>
          {missing.length === 0 ? (
            <p className="mt-2 text-xs text-emerald-400">Full coverage.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {missing.map((kw) => (
                <li key={kw} className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${missingClass}`}>
                  {kw}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AtsScannerTool() {
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [jobText, setJobText] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusLabel, setStatusLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<AtsMatchAnalysis | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const loadFile = useCallback((file: File) => {
    setError(null);
    setResults(null);
    if (!isSupportedResumeFile(file) && !file.name.toLowerCase().endsWith('.txt') && file.type !== 'text/plain') {
      setError('Please upload a PDF, DOCX, TXT, JPG, PNG, or HEIC resume.');
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
      setError('Paste the target job description to compare against.');
      return;
    }

    setBusy(true);
    setStatusLabel('Reading resume text…');

    try {
      const resumeText = await extractResumeText(currentFile, setStatusLabel);

      if (!resumeText.trim()) {
        setError('No text could be extracted. Try a clearer scan or a text-based document.');
        return;
      }

      setStatusLabel('Tokenizing and matching keywords…');
      const analysis = await analyzeNlpMatch(resumeText, trimmedJob);
      setResults(analysis);
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes('job description')
          ? err.message
          : toProcessingError(err)
      );
      setResults(null);
    } finally {
      setBusy(false);
      setStatusLabel('');
    }
  }, [currentFile, jobText]);

  const gaugeOffset = results ? 283 - (results.score / 100) * 283 : 283;
  const ringColor = results ? scoreColor(results.score) : '#34d399';

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
            className={`cursor-pointer rounded-2xl border-2 border-dashed bg-gradient-to-br from-emerald-950/40 to-slate-900/60 px-4 py-8 text-center transition focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
              dragOver
                ? 'border-emerald-400 bg-emerald-950/60'
                : 'border-emerald-700/50 hover:border-emerald-500'
            }`}
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
            <span className="text-4xl" aria-hidden="true">📄</span>
            <p className="mt-3 text-base font-bold text-white">Drop resume (PDF, DOCX, or TXT)</p>
            <p className="mt-1 text-sm text-slate-400">Scanned images supported via local OCR</p>
          </div>

          {currentFile && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
              <p className="truncate text-sm font-semibold text-white">{currentFile.name}</p>
              <p className="text-xs text-slate-500">{formatSize(currentFile.size)}</p>
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-300">Target job description</span>
            <textarea
              rows={12}
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              disabled={busy}
              className="input-field w-full resize-y text-sm leading-relaxed"
              placeholder="Paste the full job posting — requirements, skills, responsibilities…"
            />
          </label>

          {error && (
            <p className="text-sm text-rose-400" role="alert">{error}</p>
          )}

          <button
            type="button"
            onClick={() => void scanResume()}
            disabled={busy}
            className="btn-primary w-full py-3 text-base font-bold disabled:opacity-60"
          >
            {busy ? 'Analyzing…' : 'Run ATS Match Analysis'}
          </button>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-white">Jobscan-style match report</h2>

          {!results ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 px-6 py-16 text-center">
              <p className="text-sm text-slate-500">
                Upload a resume and paste a job description to see match score, skill gaps, and formatting tips.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-5 text-center">
                <div className="relative mx-auto h-36 w-36" role="img" aria-label={`Match score ${results.score} percent`}>
                  <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#1e293b" strokeWidth="10" />
                    <circle
                      cx="50" cy="50" r="45" fill="none" stroke={ringColor} strokeWidth="10"
                      strokeLinecap="round" strokeDasharray="283" strokeDashoffset={gaugeOffset}
                      className="transition-all duration-700"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-extrabold tabular-nums text-white">{results.score}%</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Match Score</span>
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  {results.matched.length} of {results.totalJdTerms} JD terms found · Resume {results.resumeWordCount} words
                </p>
              </div>

              <div className="rounded-xl border border-rose-900/40 bg-rose-950/10 p-4">
                <h3 className="text-sm font-semibold text-rose-300">Missing high-frequency keywords</h3>
                <p className="mt-1 text-xs text-slate-500">Most repeated terms in the JD not found in your resume.</p>
                {results.missingHighFrequency.length === 0 ? (
                  <p className="mt-3 text-xs text-emerald-400">Strong overlap on top JD terms.</p>
                ) : (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {results.missingHighFrequency.map((kw) => (
                      <li key={kw} className="rounded-full bg-rose-950/70 px-3 py-1 text-xs font-semibold text-rose-200 ring-1 ring-rose-700/80">
                        {kw}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <SkillList
                title="Hard skills"
                matched={results.hardSkills.matched}
                missing={results.hardSkills.missing}
                matchedClass="bg-emerald-950/60 text-emerald-300 ring-emerald-800"
                missingClass="bg-rose-950/60 text-rose-200 ring-rose-800"
              />

              <SkillList
                title="Soft skills"
                matched={results.softSkills.matched}
                missing={results.softSkills.missing}
                matchedClass="bg-sky-950/60 text-sky-300 ring-sky-800"
                missingClass="bg-amber-950/60 text-amber-200 ring-amber-800"
              />

              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <h3 className="text-sm font-semibold text-white">Formatting &amp; typography warnings</h3>
                <ul className="mt-3 space-y-2">
                  {results.formattingWarnings.map((w, i) => (
                    <li key={i} className={`rounded-lg border px-3 py-2 text-xs ${warningClass(w.type)}`}>
                      {w.message}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>

      {busy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm" role="status">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-800/50 bg-slate-900/95 px-8 py-6">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-400" />
            <p className="text-sm font-medium text-emerald-300">{statusLabel || 'Processing…'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
