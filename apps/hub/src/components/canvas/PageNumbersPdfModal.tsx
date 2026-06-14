import { useCallback, useState } from 'react';
import { addPageNumbersInBrowser, triggerPdfDownload } from '../../lib/canvas/documentPdfTools';
import {
  PAGE_NUMBER_FORMATS,
  PAGE_NUMBER_HORIZONTAL_OPTIONS,
  PAGE_NUMBER_VERTICAL_OPTIONS,
  type PageNumberFormat,
  type PageNumberHorizontal,
  type PageNumberVertical,
} from '../../lib/pdf/pdfOverlay';

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

export default function PageNumbersPdfModal({
  file,
  onClose,
  onSuccess,
  onProcessingChange,
}: Props) {
  const [vertical, setVertical] = useState<PageNumberVertical>('bottom');
  const [horizontal, setHorizontal] = useState<PageNumberHorizontal>('center');
  const [format, setFormat] = useState<PageNumberFormat>('plain');
  const [startNumber, setStartNumber] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reportProgress = useCallback(
    (current: number, total: number, label: string) => {
      const percent = total > 0 ? Math.round((current / total) * 100) : 0;
      onProcessingChange(true, label, percent);
    },
    [onProcessingChange]
  );

  const handleApply = useCallback(async () => {
    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Adding page numbers…', 0);

    try {
      const { bytes, downloadName } = await addPageNumbersInBrowser(
        file,
        {
          vertical,
          horizontal,
          format,
          fontSize: 11,
          color: '#333333',
          startNumber: Math.max(1, startNumber),
        },
        ({ current, total, label }) => reportProgress(current, total, label)
      );
      triggerPdfDownload(bytes, downloadName, '_numbered');
      onProcessingChange(false, '', 0);
      onSuccess('Page numbers added — download started.');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add page numbers.');
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [
    file,
    format,
    horizontal,
    onClose,
    onProcessingChange,
    onSuccess,
    reportProgress,
    startNumber,
    vertical,
  ]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="page-numbers-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="page-numbers-title" className="text-lg font-bold text-slate-900">
              Add Page Numbers
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

        <fieldset className="mt-4">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Format
          </legend>
          <div className="flex flex-wrap gap-2">
            {PAGE_NUMBER_FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                disabled={busy}
                onClick={() => setFormat(f.id)}
                className={pillClass(format === f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Vertical
          </legend>
          <div className="flex flex-wrap gap-2">
            {PAGE_NUMBER_VERTICAL_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={busy}
                onClick={() => setVertical(opt.id)}
                className={pillClass(vertical === opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Horizontal
          </legend>
          <div className="flex flex-wrap gap-2">
            {PAGE_NUMBER_HORIZONTAL_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={busy}
                onClick={() => setHorizontal(opt.id)}
                className={pillClass(horizontal === opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Starting number
          </span>
          <input
            type="number"
            min={1}
            value={startNumber}
            disabled={busy}
            onChange={(e) => setStartNumber(Math.max(1, Number(e.target.value) || 1))}
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none ring-emerald-500/30 focus:border-emerald-400 focus:ring-2 tabular-nums disabled:bg-slate-50"
          />
        </label>

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
            onClick={() => void handleApply()}
            disabled={busy}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Stamping…' : 'Apply & download'}
          </button>
        </div>
      </div>
    </div>
  );
}
