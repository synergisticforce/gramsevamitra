import { useCallback, useState } from 'react';
import { analyzeAtsMatch, type AtsScanResult } from '../../lib/canvas/careerAtsMatch';
import { extractTextFromPdfFile } from '../../lib/canvas/careerPdfText';

interface Props {
  file: File;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

type Step = 'input' | 'results';

function scoreColor(score: number): string {
  if (score >= 75) return 'text-canvas-accent';
  if (score >= 50) return 'text-canvas-muted';
  return 'text-rose-600';
}

function scoreRingColor(score: number): string {
  if (score >= 75) return 'stroke-emerald-500';
  if (score >= 50) return 'stroke-amber-500';
  return 'stroke-rose-500';
}

export default function AtsScannerModal({
  file,
  onClose,
  onSuccess,
  onProcessingChange,
}: Props) {
  const [step, setStep] = useState<Step>('input');
  const [jobDescription, setJobDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AtsScanResult | null>(null);

  const handleScan = useCallback(async () => {
    if (!jobDescription.trim()) {
      setError('Paste the target job description to compare against your resume.');
      return;
    }

    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Reading resume PDF…', 5);

    try {
      const resumeText = await extractTextFromPdfFile(file, (current, total) => {
        const percent = 5 + Math.round((current / total) * 45);
        onProcessingChange(true, `Extracting text — page ${current} of ${total}…`, percent);
      });

      onProcessingChange(true, 'Matching keywords…', 60);
      const analysis = await analyzeAtsMatch(resumeText, jobDescription);

      onProcessingChange(true, 'Building results…', 95);
      setResult(analysis);
      setStep('results');
      onProcessingChange(false, '', 0);
      onSuccess(`ATS scan complete — ${analysis.score}% match score.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ATS scan failed.');
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [file, jobDescription, onProcessingChange, onSuccess]);

  const handleRescan = () => {
    setStep('input');
    setResult(null);
    setError(null);
  };

  const circumference = 2 * Math.PI * 42;
  const score = result?.score ?? 0;
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ats-scanner-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="ats-scanner-title" className="text-lg font-bold text-canvas-text">
              🔍 ATS Scanner
            </h2>
            <p className="mt-1 text-xs text-canvas-subtle truncate">{file.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg px-2 py-1 text-canvas-subtle transition hover:bg-canvas-elevated hover:text-canvas-muted disabled:opacity-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {step === 'input' && (
          <>
            <p className="mt-4 text-sm text-canvas-muted">
              Paste the job description below. Your resume PDF is parsed locally — nothing is uploaded.
            </p>
            <label className="mt-3 block">
              <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
                Job description
              </span>
              <textarea
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
                rows={8}
                disabled={busy}
                placeholder="Paste the full job posting here — requirements, skills, and responsibilities…"
                className="mt-1.5 w-full resize-y rounded-xl border border-canvas-border px-3 py-2.5 text-sm text-canvas-text outline-none ring-sky-500/30 focus:border-sky-400 focus:ring-2 disabled:bg-canvas-elevated"
              />
            </label>
          </>
        )}

        {step === 'results' && result && (
          <div className="mt-4 space-y-5">
            <div className="flex flex-col items-center rounded-2xl border border-slate-100 bg-canvas-elevated px-4 py-6">
              <div className="relative h-28 w-28">
                <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    strokeWidth="8"
                    className="stroke-slate-200"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    strokeWidth="8"
                    strokeLinecap="round"
                    className={scoreRingColor(result.score)}
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-3xl font-bold ${scoreColor(result.score)}`}>
                    {result.score}%
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-canvas-subtle">
                    Match
                  </span>
                </div>
              </div>
              <p className="mt-3 text-center text-sm text-canvas-muted">
                {result.matchedCount} of {result.totalJobTerms} job keywords found in your resume
                {result.resumeWordCount > 0 ? ` · ${result.resumeWordCount} resume words` : ''}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-canvas-text">Missing keywords</h3>
              <p className="mt-0.5 text-xs text-canvas-subtle">
                High-frequency terms from the job description not detected in your resume.
              </p>
              {result.missingKeywords.length === 0 ? (
                <p className="mt-3 rounded-xl border border-emerald-200 bg-canvas-accent-soft px-3 py-2 text-sm text-canvas-accent">
                  Great match — no major keyword gaps detected.
                </p>
              ) : (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {result.missingKeywords.map((keyword) => (
                    <li
                      key={keyword}
                      className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-800"
                    >
                      {keyword}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              type="button"
              onClick={handleRescan}
              className="text-sm font-semibold text-sky-700 underline-offset-2 hover:underline"
            >
              Scan with a different job description
            </button>
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-canvas-border px-4 py-2.5 text-sm font-semibold text-canvas-muted transition hover:bg-canvas-elevated disabled:opacity-50"
          >
            {step === 'results' ? 'Done' : 'Cancel'}
          </button>
          {step === 'input' && (
            <button
              type="button"
              onClick={() => void handleScan()}
              disabled={busy}
              className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Scanning…' : 'Scan resume'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
