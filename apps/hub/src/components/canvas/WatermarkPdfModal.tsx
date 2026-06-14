import { useCallback, useState } from 'react';
import { watermarkPdfInBrowser, triggerPdfDownload } from '../../lib/canvas/documentPdfTools';
import {
  WATERMARK_POSITIONS,
  type OverlayPosition,
} from '../../lib/pdf/pdfOverlay';

interface Props {
  file: File;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

function pillClass(active: boolean): string {
  return `rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
    active
      ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
      : 'border-slate-200 text-slate-600 hover:border-emerald-300'
  }`;
}

export default function WatermarkPdfModal({
  file,
  onClose,
  onSuccess,
  onProcessingChange,
}: Props) {
  const [text, setText] = useState('DRAFT');
  const [opacity, setOpacity] = useState(20);
  const [position, setPosition] = useState<OverlayPosition>('center');
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
    if (!text.trim()) {
      setError('Enter watermark text.');
      return;
    }

    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Applying watermark…', 0);

    try {
      const { bytes, downloadName } = await watermarkPdfInBrowser(
        file,
        {
          text,
          position,
          opacity: opacity / 100,
          rotation: -30,
        },
        ({ current, total, label }) => reportProgress(current, total, label)
      );
      triggerPdfDownload(bytes, downloadName, '_watermarked');
      onProcessingChange(false, '', 0);
      onSuccess('Watermark applied — download started.');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Watermark failed.');
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [file, onClose, onProcessingChange, onSuccess, opacity, position, reportProgress, text]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="watermark-pdf-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="watermark-pdf-title" className="text-lg font-bold text-slate-900">
              Add Watermark
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

        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Watermark text
          </span>
          <input
            type="text"
            value={text}
            disabled={busy}
            onChange={(e) => setText(e.target.value)}
            placeholder="DRAFT"
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none ring-emerald-500/30 focus:border-emerald-400 focus:ring-2 disabled:bg-slate-50"
          />
        </label>

        <label className="mt-4 block">
          <div className="mb-1 flex justify-between text-xs text-slate-600">
            <span className="font-medium">Opacity</span>
            <span className="tabular-nums">{opacity}%</span>
          </div>
          <input
            type="range"
            min={5}
            max={80}
            value={opacity}
            disabled={busy}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="w-full accent-emerald-600"
          />
        </label>

        <fieldset className="mt-4">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Position
          </legend>
          <div className="flex flex-wrap gap-2">
            {WATERMARK_POSITIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={busy}
                onClick={() => setPosition(opt.id)}
                className={pillClass(position === opt.id)}
              >
                {opt.label}
              </button>
            ))}
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
            onClick={() => void handleApply()}
            disabled={busy}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Applying…' : 'Apply & download'}
          </button>
        </div>
      </div>
    </div>
  );
}
