import { useCallback, useState } from 'react';
import { formatFileSize } from '../../lib/canvas/documentCanvasStorage';
import { BG_MODEL_MB, type BackgroundFill } from '../../lib/canvas/removeBackground';
import { triggerImageDownload } from '../../lib/canvas/mediaImageTools';

interface Props {
  file: File;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

const FILLS: Array<{ id: BackgroundFill; label: string; swatch: string }> = [
  { id: 'transparent', label: 'Transparent', swatch: 'bg-canvas-elevated' },
  { id: 'white', label: 'White', swatch: 'bg-white' },
  { id: 'blue', label: 'Blue', swatch: 'bg-blue-600' },
  { id: 'red', label: 'Red', swatch: 'bg-red-600' },
];

export default function RemoveBackgroundModal({
  file,
  onClose,
  onSuccess,
  onProcessingChange,
}: Props) {
  const [fill, setFill] = useState<BackgroundFill>('white');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleRun = useCallback(async () => {
    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Starting…', 2);

    try {
      const { removeBackgroundInBrowser } = await import('../../lib/canvas/removeBackground');
      const result = await removeBackgroundInBrowser(file, fill, ({ label, percent }) =>
        onProcessingChange(true, label, percent),
      );

      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(result.blob);
      });

      triggerImageDownload(result.blob, result.downloadName, '_filtered');
      onProcessingChange(false, '', 0);
      onSuccess(`Background removed — ${result.width}×${result.height} px.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not remove the background. Please try again.',
      );
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [file, fill, onProcessingChange, onSuccess]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="remove-bg-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-canvas-border bg-canvas-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="remove-bg-title" className="text-lg font-bold text-canvas-text">
              Remove Background
            </h2>
            <p className="mt-1 truncate text-xs font-medium leading-relaxed text-slate-300">
              {file.name} · {formatFileSize(file.size)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-canvas-subtle transition hover:bg-canvas-elevated disabled:opacity-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className="mt-3 text-sm font-medium leading-relaxed text-slate-200">
          Cuts out the person or object and replaces the background. Free, and your photo never
          leaves this device.
        </p>

        <p className="mt-2 text-xs font-medium leading-relaxed text-slate-400">
          The first use downloads a {BG_MODEL_MB} MB cut-out model — best on Wi-Fi. After that it
          works offline.
        </p>

        {previewUrl && (
          <div className="mt-4 flex items-center justify-center overflow-hidden rounded-xl border border-canvas-border bg-[repeating-conic-gradient(#334155_0%_25%,#1e293b_0%_50%)] bg-[length:16px_16px] p-3">
            <img
              src={previewUrl}
              alt="Background removed preview"
              className="max-h-56 max-w-full object-contain"
            />
          </div>
        )}

        <div className="mt-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
            New background
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {FILLS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setFill(option.id)}
                disabled={busy}
                aria-pressed={fill === option.id}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition disabled:opacity-50 ${
                  fill === option.id
                    ? 'border-canvas-accent bg-canvas-accent-soft text-canvas-text'
                    : 'border-canvas-border bg-canvas-surface text-canvas-muted'
                }`}
              >
                <span
                  className={`h-4 w-4 rounded border border-canvas-border ${option.swatch}`}
                  aria-hidden="true"
                />
                {option.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs font-medium leading-relaxed text-slate-400">
            Most exam and ID forms ask for a plain white background.
          </p>
        </div>

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
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-canvas-border px-5 text-sm font-semibold text-canvas-muted transition hover:bg-canvas-elevated disabled:opacity-50"
          >
            {previewUrl ? 'Done' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => void handleRun()}
            disabled={busy}
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-canvas-accent-muted px-5 text-sm font-bold text-canvas-text transition hover:bg-canvas-accent/40 disabled:opacity-50"
          >
            {busy ? 'Working…' : previewUrl ? 'Run again' : 'Remove background'}
          </button>
        </div>
      </div>
    </div>
  );
}
