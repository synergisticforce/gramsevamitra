import { useCallback, useState } from 'react';
import { repairPdfInBrowser, triggerPdfDownload } from '../../lib/canvas/documentPdfTools';
import { requiresChunkedPipeline } from '../../lib/pdf/fileUploadLimits';
import { runChunkedRepairPipeline } from '../../lib/upload/chunkedPipeline';

interface Props {
  file: File;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

export default function RepairPdfModal({ file, onClose, onSuccess, onProcessingChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRepair = useCallback(async () => {
    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Attempting PDF repair…', 0);

    try {
      if (requiresChunkedPipeline(file)) {
        await runChunkedRepairPipeline(file, ({ label, percent }) =>
          onProcessingChange(true, label, percent),
        );
        onProcessingChange(false, '', 0);
        onSuccess('Repair attempt complete via Smart Slicing — download started.');
        onClose();
        return;
      }

      const { bytes, downloadName } = await repairPdfInBrowser(file, ({ current, total, label }) => {
        const percent = total > 0 ? Math.round((current / total) * 100) : 0;
        onProcessingChange(true, label, percent);
      });
      triggerPdfDownload(bytes, downloadName, '_repaired');
      onProcessingChange(false, '', 0);
      onSuccess('Repair attempt complete — rebuilt PDF download started.');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Repair failed.');
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [file, onClose, onProcessingChange, onSuccess]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="repair-pdf-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="repair-pdf-title" className="text-lg font-bold text-canvas-text">
              Repair Corrupt PDF
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
          Rebuilds broken cross-reference tables and trims corrupted incremental update chains. Severely
          damaged files may still fail — no data is uploaded unless Smart Slicing is required for size.
        </p>

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
            onClick={() => void handleRepair()}
            disabled={busy}
            className="rounded-xl bg-canvas-accent-muted px-4 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Repairing…' : 'Repair & download'}
          </button>
        </div>
      </div>
    </div>
  );
}
