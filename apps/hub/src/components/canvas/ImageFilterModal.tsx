import { useCallback, useState } from 'react';
import {
  filterImageInBrowser,
  triggerImageDownload,
  type ImageFilterMode,
} from '../../lib/canvas/mediaImageTools';

interface Props {
  file: File;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

export default function ImageFilterModal({
  file,
  onClose,
  onSuccess,
  onProcessingChange,
}: Props) {
  const [mode, setMode] = useState<ImageFilterMode>('grayscale');
  const [threshold, setThreshold] = useState(128);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApply = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Applying filter…', 15);
    try {
      const { blob, downloadName } = await filterImageInBrowser(
        file,
        mode,
        threshold,
        ({ percent, label }) => onProcessingChange(true, label, percent),
      );
      triggerImageDownload(blob, downloadName, '_filtered');
      onProcessingChange(false, '', 0);
      onSuccess(`Filtered image downloaded — ${downloadName}`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Filter failed.');
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [busy, file, mode, onClose, onProcessingChange, onSuccess, threshold]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-filter-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="image-filter-title" className="text-lg font-bold text-canvas-text">
              🎨 Filter Suite
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

        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              { id: 'grayscale' as const, label: 'Grayscale' },
              { id: 'bw-threshold' as const, label: 'B&W Threshold' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={busy}
              onClick={() => setMode(item.id)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                mode === item.id
                  ? 'bg-canvas-accent-muted text-white'
                  : 'border border-canvas-border bg-canvas-surface text-slate-200 hover:bg-canvas-elevated'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {mode === 'bw-threshold' && (
          <label className="mt-4 block text-sm">
            <span className="mb-1 block font-medium text-slate-200">Threshold: {threshold}</span>
            <input
              type="range"
              min={0}
              max={255}
              value={threshold}
              disabled={busy}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full accent-violet-500"
            />
            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-300">
              Pixels above the threshold become white; below become black.
            </p>
          </label>
        )}

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
            {busy ? 'Processing…' : 'Apply & download'}
          </button>
        </div>
      </div>
    </div>
  );
}
