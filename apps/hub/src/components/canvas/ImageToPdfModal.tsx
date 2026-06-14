import { useCallback, useState } from 'react';
import { imageToPdfInBrowser, triggerPdfDownload } from '../../lib/canvas/documentPdfTools';

interface Props {
  file: File;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

export default function ImageToPdfModal({ file, onClose, onSuccess, onProcessingChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reportProgress = useCallback(
    (current: number, total: number, label: string) => {
      const percent = total > 0 ? Math.round((current / total) * 100) : 0;
      onProcessingChange(true, label, percent);
    },
    [onProcessingChange]
  );

  const handleConvert = useCallback(async () => {
    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Converting image to PDF…', 0);

    try {
      const { bytes, downloadName } = await imageToPdfInBrowser(file, ({ current, total, label }) =>
        reportProgress(current, total, label)
      );
      triggerPdfDownload(bytes, downloadName, '_converted');
      onProcessingChange(false, '', 0);
      onSuccess('Image converted to PDF — download started.');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed.');
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [file, onClose, onProcessingChange, onSuccess, reportProgress]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-to-pdf-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="image-to-pdf-title" className="text-lg font-bold text-slate-900">
              JPG / PNG to PDF
            </h2>
            <p className="mt-1 text-xs text-slate-500 truncate">{file.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className="mt-4 text-sm text-slate-600">
          Embed your image as a full-page PDF document. Processing runs locally in your browser.
        </p>

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
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleConvert()}
            disabled={busy}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Converting…' : 'Convert & download'}
          </button>
        </div>
      </div>
    </div>
  );
}
