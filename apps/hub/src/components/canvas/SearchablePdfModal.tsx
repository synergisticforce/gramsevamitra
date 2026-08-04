import { useCallback, useState } from 'react';
import { formatFileSize } from '../../lib/canvas/documentCanvasStorage';
import { triggerPdfDownload } from '../../lib/canvas/documentPdfTools';

interface Props {
  file: File;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

export default function SearchablePdfModal({
  file,
  onClose,
  onSuccess,
  onProcessingChange,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = useCallback(async () => {
    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Starting…', 2);

    try {
      const { buildSearchablePdf } = await import('../../lib/canvas/searchablePdf');
      const result = await buildSearchablePdf(file, ({ label, percent }) =>
        onProcessingChange(true, label, percent),
      );

      triggerPdfDownload(result.bytes, result.downloadName, '_searchable');
      onProcessingChange(false, '', 0);

      const pageWord = result.pageCount === 1 ? 'page' : 'pages';
      onSuccess(
        result.wordCount === 0
          ? `Saved ${result.pageCount} ${pageWord}, but no text was found. Try a sharper, brighter scan.`
          : `Searchable PDF ready — ${result.wordCount} words across ${result.pageCount} ${pageWord}.${
              result.partialLanguageSupport
                ? ' Hindi words stay visible but are not searchable yet.'
                : ''
            }`,
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the searchable PDF.');
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [file, onClose, onProcessingChange, onSuccess]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="searchable-pdf-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-t-2xl border border-canvas-border bg-canvas-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="searchable-pdf-title" className="text-lg font-bold text-canvas-text">
              Make PDF Searchable
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

        <p className="mt-4 text-sm font-medium leading-relaxed text-slate-200">
          Your page stays exactly as it looks now, but the words become selectable — so you can
          copy text or find a name inside the file later.
        </p>

        <ul className="mt-4 space-y-2 rounded-xl border border-canvas-border bg-canvas-elevated px-4 py-3 text-sm font-medium leading-relaxed text-slate-200">
          <li>Runs on your phone — nothing is uploaded.</li>
          <li>Works best on flat, well-lit pages of printed text.</li>
          <li>English text becomes searchable; Hindi stays visible in the image.</li>
        </ul>

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
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleRun()}
            disabled={busy}
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-canvas-accent-muted px-5 text-sm font-bold text-canvas-text transition hover:bg-canvas-accent/40 disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Make searchable'}
          </button>
        </div>
      </div>
    </div>
  );
}
