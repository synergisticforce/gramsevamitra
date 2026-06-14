import { useCallback, useState } from 'react';
import {
  copyTextToClipboard,
  downloadTextFile,
} from '../../lib/canvas/careerCoverLetter';
import type { CareerProAiResult } from '../../lib/canvas/careerProAi';

interface Props {
  result: CareerProAiResult;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export default function CareerAiResultModal({ result, onClose, onSuccess }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await copyTextToClipboard(result.text);
      setCopied(true);
      onSuccess('AI result copied to clipboard.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onSuccess('Could not copy — try downloading instead.');
    }
  }, [onSuccess, result.text]);

  const handleDownload = useCallback(() => {
    downloadTextFile(result.text, result.fileName);
    onSuccess('AI result downloaded as .txt file.');
  }, [onSuccess, result.fileName, result.text]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="career-ai-result-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">⚡ Pro AI</p>
            <h2 id="career-ai-result-title" className="mt-1 text-lg font-bold text-slate-900">
              {result.title}
            </h2>
            {result.processingMs != null && result.processingMs > 0 && (
              <p className="mt-0.5 text-xs text-slate-500">
                Processed in {Math.round(result.processingMs / 1000)}s · mock edge LLM
              </p>
            )}
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

        <pre className="mt-4 max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50/80 to-white p-4 font-sans text-sm leading-relaxed text-slate-800">
          {result.text}
        </pre>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {copied ? 'Copied!' : 'Copy to clipboard'}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700"
          >
            Download .txt
          </button>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
