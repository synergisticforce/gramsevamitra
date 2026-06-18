import { useCallback, useState } from 'react';
import { photoToScannedPdfInBrowser, triggerPdfDownload } from '../../lib/canvas/documentPdfTools';

interface Props {
  file: File;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

export default function PhotoScannedPdfModal({
  file,
  onClose,
  onSuccess,
  onProcessingChange,
}: Props) {
  const [contrast, setContrast] = useState(40);
  const [threshold, setThreshold] = useState(128);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConvert = useCallback(async () => {
    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Creating scanned PDF…', 0);

    try {
      const { bytes, downloadName } = await photoToScannedPdfInBrowser(
        file,
        { contrast, threshold },
        ({ current, total, label }) => {
          const percent = total > 0 ? Math.round((current / total) * 100) : 0;
          onProcessingChange(true, label, percent);
        },
      );
      triggerPdfDownload(bytes, downloadName, '_scanned');
      onProcessingChange(false, '', 0);
      onSuccess('Scanned-style PDF ready — download started.');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed.');
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [contrast, file, onClose, onProcessingChange, onSuccess, threshold]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-scanned-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="photo-scanned-title" className="text-lg font-bold text-canvas-text">
              Photo to Scanned PDF
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
          Applies a high-contrast black-and-white scanner effect, then embeds the result as a clean PDF
          page. Processing runs locally in your browser.
        </p>

        <label className="mt-4 block">
          <span className="text-xs font-semibold text-slate-200">Contrast ({contrast})</span>
          <input
            type="range"
            min={0}
            max={80}
            value={contrast}
            onChange={(e) => setContrast(Number(e.target.value))}
            disabled={busy}
            className="mt-1 w-full accent-emerald-500"
          />
        </label>

        <label className="mt-3 block">
          <span className="text-xs font-semibold text-slate-200">B/W threshold ({threshold})</span>
          <input
            type="range"
            min={64}
            max={220}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            disabled={busy}
            className="mt-1 w-full accent-emerald-500"
          />
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
            onClick={() => void handleConvert()}
            disabled={busy}
            className="rounded-xl bg-canvas-accent-muted px-4 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Converting…' : 'Create scanned PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
