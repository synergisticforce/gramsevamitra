import { useCallback, useState } from 'react';
import { deskewPdfInBrowser, triggerPdfDownload } from '../../lib/canvas/documentPdfTools';
import { requiresChunkedPipeline } from '../../lib/pdf/fileUploadLimits';
import { CHUNKED_RENDER_UNSUPPORTED_MESSAGE } from '../../lib/upload/chunkedPipeline';

interface Props {
  file: File;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

export default function DeskewPdfModal({ file, onClose, onSuccess, onProcessingChange }: Props) {
  const [degrees, setDegrees] = useState(0);
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
    if (degrees === 0) {
      setError('Adjust the rotation slider to straighten your scan.');
      return;
    }

    if (requiresChunkedPipeline(file)) {
      setError(CHUNKED_RENDER_UNSUPPORTED_MESSAGE);
      return;
    }

    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Straightening pages…', 0);

    try {
      const { bytes, downloadName } = await deskewPdfInBrowser(file, degrees, ({ current, total, label }) =>
        reportProgress(current, total, label)
      );
      triggerPdfDownload(bytes, downloadName, '_straightened');
      onProcessingChange(false, '', 0);
      onSuccess(`Straightened ${degrees}° — download started.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Straighten failed.');
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [degrees, file, onClose, onProcessingChange, onSuccess, reportProgress]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deskew-pdf-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="deskew-pdf-title" className="text-lg font-bold text-canvas-text">
              Straighten / Deskew
            </h2>
            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-300 truncate">{file.name}</p>
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

        <p className="mt-4 text-sm font-medium leading-relaxed text-slate-200">
          Rotate all pages to correct a tilted scan. Processing runs locally in your browser.
        </p>

        <label className="mt-4 block">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-canvas-muted">Rotation</span>
            <span className="text-sm font-bold tabular-nums text-canvas-accent">{degrees}°</span>
          </div>
          <input
            type="range"
            min={-45}
            max={45}
            step={1}
            value={degrees}
            disabled={busy}
            onChange={(e) => setDegrees(Number(e.target.value))}
            className="w-full accent-emerald-600"
          />
          <div className="mt-1 flex justify-between text-[10px] text-canvas-subtle">
            <span>-45°</span>
            <span>0°</span>
            <span>+45°</span>
          </div>
        </label>

        {error && (
          <p className="mt-3 rounded-lg border border-canvas-border bg-canvas-danger-soft/30 px-3 py-2 text-sm text-rose-200">
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
            {busy ? 'Straightening…' : 'Apply & download'}
          </button>
        </div>
      </div>
    </div>
  );
}
