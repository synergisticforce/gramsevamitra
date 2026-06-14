import { useCallback, useState } from 'react';
import {
  exportPdfToJpgInBrowser,
  exportPdfToPngInBrowser,
} from '../../lib/canvas/documentPdfTools';

type ImageFormat = 'jpg' | 'png';

interface Props {
  file: File;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

function pillClass(active: boolean): string {
  return `rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
    active
      ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
      : 'border-slate-200 text-slate-600 hover:border-emerald-300'
  }`;
}

export default function PdfToImageModal({ file, onClose, onSuccess, onProcessingChange }: Props) {
  const [format, setFormat] = useState<ImageFormat>('jpg');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reportProgress = useCallback(
    (current: number, total: number, label: string) => {
      const percent = total > 0 ? Math.round((current / total) * 100) : 0;
      onProcessingChange(true, label, percent);
    },
    [onProcessingChange]
  );

  const handleExport = useCallback(async () => {
    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Exporting pages…', 0);

    try {
      const result =
        format === 'jpg'
          ? await exportPdfToJpgInBrowser(file, 2, 0.92, ({ current, total, label }) =>
              reportProgress(current, total, label)
            )
          : await exportPdfToPngInBrowser(file, 2, ({ current, total, label }) =>
              reportProgress(current, total, label)
            );

      onProcessingChange(false, '', 0);
      const ext = format === 'jpg' ? 'JPG' : 'PNG';
      onSuccess(`Exported ${result.pageCount} ${ext} page(s) — downloads started.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [file, format, onClose, onProcessingChange, onSuccess, reportProgress]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-to-image-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="pdf-to-image-title" className="text-lg font-bold text-slate-900">
              PDF to JPG / PNG
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
          Each PDF page is rendered via Canvas and downloaded as a separate image file.
        </p>

        <fieldset className="mt-4">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Output format
          </legend>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setFormat('jpg')}
              className={pillClass(format === 'jpg')}
            >
              JPG
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setFormat('png')}
              className={pillClass(format === 'png')}
            >
              PNG
            </button>
          </div>
        </fieldset>

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
            onClick={() => void handleExport()}
            disabled={busy}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Exporting…' : 'Export & download'}
          </button>
        </div>
      </div>
    </div>
  );
}
