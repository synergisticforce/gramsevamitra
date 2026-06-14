import { useCallback, useMemo, useState } from 'react';
import {
  buildCoverLetterText,
  copyTextToClipboard,
  coverLetterDownloadName,
  downloadTextFile,
  type CoverLetterInput,
} from '../../lib/canvas/careerCoverLetter';

interface Props {
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const EMPTY_FORM: CoverLetterInput = {
  userName: '',
  targetRole: '',
  companyName: '',
};

export default function CoverLetterModal({ onClose, onSuccess }: Props) {
  const [form, setForm] = useState<CoverLetterInput>(EMPTY_FORM);
  const [step, setStep] = useState<'form' | 'preview'>('form');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const letterText = useMemo(() => buildCoverLetterText(form), [form]);

  const update = useCallback((patch: Partial<CoverLetterInput>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setError(null);
  }, []);

  const handleGenerate = useCallback(() => {
    if (!form.userName.trim() || !form.targetRole.trim() || !form.companyName.trim()) {
      setError('Please fill in your name, target role, and company name.');
      return;
    }
    setStep('preview');
  }, [form]);

  const handleCopy = useCallback(async () => {
    try {
      await copyTextToClipboard(letterText);
      setCopied(true);
      onSuccess('Cover letter copied to clipboard.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy to clipboard. Try downloading instead.');
    }
  }, [letterText, onSuccess]);

  const handleDownload = useCallback(() => {
    downloadTextFile(letterText, coverLetterDownloadName(form.companyName));
    onSuccess('Cover letter downloaded as .txt file.');
  }, [form.companyName, letterText, onSuccess]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cover-letter-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="cover-letter-title" className="text-lg font-bold text-slate-900">
              📄 Cover Letter Template
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Generated entirely in your browser — no data sent to servers.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {step === 'form' && (
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Your name
              </span>
              <input
                type="text"
                value={form.userName}
                onChange={(event) => update({ userName: event.target.value })}
                placeholder="e.g. Priya Sharma"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none ring-sky-500/30 focus:border-sky-400 focus:ring-2"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Target role
              </span>
              <input
                type="text"
                value={form.targetRole}
                onChange={(event) => update({ targetRole: event.target.value })}
                placeholder="e.g. Software Engineer"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none ring-sky-500/30 focus:border-sky-400 focus:ring-2"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Company name
              </span>
              <input
                type="text"
                value={form.companyName}
                onChange={(event) => update({ companyName: event.target.value })}
                placeholder="e.g. Infosys"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none ring-sky-500/30 focus:border-sky-400 focus:ring-2"
              />
            </label>
          </div>
        )}

        {step === 'preview' && (
          <div className="mt-4">
            <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 font-sans text-sm leading-relaxed text-slate-800">
              {letterText}
            </pre>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {copied ? 'Copied!' : 'Copy to clipboard'}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
              >
                Download .txt
              </button>
            </div>
            <button
              type="button"
              onClick={() => setStep('form')}
              className="mt-3 text-sm font-semibold text-sky-700 underline-offset-2 hover:underline"
            >
              Edit details
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
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {step === 'preview' ? 'Done' : 'Cancel'}
          </button>
          {step === 'form' && (
            <button
              type="button"
              onClick={handleGenerate}
              className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              Generate letter
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
