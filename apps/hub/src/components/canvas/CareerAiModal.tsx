import { useState } from 'react';
import { extractResumeText } from '../../lib/canvas/careerPdfText';
import {
  resolveCareerProAction,
  runCareerProAiPipeline,
  type CareerProAiResult,
} from '../../lib/canvas/careerProAi';

interface Props {
  file: File;
  actionId: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onResult: (result: CareerProAiResult) => void;
  onProcessingChange: (active: boolean, label: string, percent: number, subtitle?: string) => void;
}

export default function CareerAiModal({
  file,
  actionId,
  onClose,
  onSuccess,
  onResult,
  onProcessingChange,
}: Props) {
  const action = resolveCareerProAction(actionId);
  const [jobText, setJobText] = useState('');
  const [language, setLanguage] = useState('en');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title =
    action === 'rewrite_resume'
      ? 'AI Resume Rewriter'
      : action === 'interview_coach'
        ? 'Interview Coach'
        : 'AI Cover Letter';

  const handleRun = () => {
    if (!action) {
      setError('This career tool is not available.');
      return;
    }
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        onProcessingChange(true, 'Reading the resume on this device…', 8, 'Only the extracted text is sent to the model.');
        const resumeText = await extractResumeText(file, (current, total) => {
          const percent = 8 + Math.round((current / total) * 25);
          onProcessingChange(true, `Reading page ${current} of ${total}…`, percent, 'Only the extracted text is sent to the model.');
        });
        const result = await runCareerProAiPipeline(
          resumeText,
          file.name,
          action,
          ({ label, percent }) => {
            onProcessingChange(true, label, percent, 'Only the extracted text is sent to the model.');
          },
          jobText,
          language,
        );
        onProcessingChange(false, '', 0);
        const quota =
          typeof result.quotaRemaining === 'number'
            ? ` ${result.quotaRemaining} free generation${result.quotaRemaining === 1 ? '' : 's'} left this month.`
            : '';
        const credits = result.creditsCharged ? ` ${result.creditsCharged} AI Credits used.` : ' No credits were charged.';
        onSuccess(`${title} is ready.${credits}${quota}`);
        onResult(result);
        onClose();
      } catch (err) {
        onProcessingChange(false, '', 0);
        setError(err instanceof Error ? err.message : 'Career AI failed.');
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="career-ai-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-canvas-border bg-canvas-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="career-ai-title" className="text-lg font-bold text-canvas-text">
              {title}
            </h2>
            <p className="mt-1 truncate text-xs text-slate-300">{file.name}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg px-2 py-1 text-canvas-subtle" aria-label="Close">
            ✕
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-200">
          Free accounts get 3 AI generations per month. Pro uses 3 AI Credits only after a real reply comes back. A failed request does not charge you.
        </p>
        <label className="mt-3 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">Language</span>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            disabled={busy}
            className="mt-1.5 w-full rounded-xl border border-canvas-border bg-canvas-surface px-3 py-2.5 text-sm text-canvas-text"
          >
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="ta">Tamil</option>
            <option value="te">Telugu</option>
            <option value="mr">Marathi</option>
            <option value="bn">Bengali</option>
            <option value="kn">Kannada</option>
            <option value="ml">Malayalam</option>
            <option value="gu">Gujarati</option>
            <option value="pa">Punjabi</option>
          </select>
        </label>
        <label className="mt-3 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
            Job description {action === 'rewrite_resume' ? '(optional)' : ''}
          </span>
          <textarea
            value={jobText}
            onChange={(event) => setJobText(event.target.value)}
            rows={6}
            disabled={busy}
            placeholder="Paste the role you are applying for, if you have it."
            className="mt-1.5 w-full resize-y rounded-xl border border-canvas-border px-3 py-2.5 text-sm text-canvas-text"
          />
        </label>
        {error && (
          <p className="mt-3 rounded-lg border border-canvas-border bg-canvas-danger-soft/30 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-canvas-border px-4 py-2.5 text-sm font-semibold text-canvas-muted">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRun}
            disabled={busy}
            className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}
