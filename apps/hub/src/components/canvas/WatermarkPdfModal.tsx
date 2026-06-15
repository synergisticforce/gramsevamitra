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
      ? 'border-canvas-accent bg-canvas-accent-soft text-canvas-accent'
      : 'border-canvas-border text-canvas-muted hover:border-emerald-300'
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
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="watermark-pdf-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="watermark-pdf-title" className="text-lg font-bold text-canvas-text">
              Add Watermark
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

        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
            Watermark text
          </span>
          <input
            type="text"
            value={text}
            disabled={busy}
            onChange={(e) => setText(e.target.value)}
            placeholder="DRAFT"
            className="mt-1.5 w-full rounded-xl border border-canvas-border px-3 py-2.5 text-sm text-canvas-text outline-none ring-canvas-accent/50/30 focus:border-canvas-accent focus:ring-2 disabled:bg-canvas-elevated"
          />
        </label>

        <label className="mt-4 block">
          <div className="mb-1 flex justify-between text-xs text-canvas-muted">
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
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
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
            className="rounded-xl border border-canvas-border px-4 py-2.5 text-sm font-semibold text-canvas-muted transition hover:bg-canvas-elevated disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={busy}
            className="rounded-xl bg-canvas-accent-muted px-4 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Applying…' : 'Apply & download'}
          </button>
        </div>
      </div>
    </div>
  );
}
