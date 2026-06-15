import { useCallback, useEffect, useState } from 'react';
import { splitPdfInBrowser, triggerPdfDownload } from '../../lib/canvas/documentPdfTools';

interface Props {
  file: File;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

function defaultRange(pageCount: number): string {
  if (pageCount <= 1) return '1';
  return `1-${Math.min(3, pageCount)}`;
}

export default function SplitPdfModal({ file, onClose, onSuccess, onProcessingChange }: Props) {
  const [pageCount, setPageCount] = useState(0);
  const [rangeInput, setRangeInput] = useState('1-3');
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoadingMeta(true);
      setError(null);
      try {
        const { getPdfPageCountFromFile } = await import('../../lib/pdf/pdfWorkerClient');
        const count = await getPdfPageCountFromFile(file);
        if (cancelled) return;
        setPageCount(count);
        setRangeInput(defaultRange(count));
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not read this PDF.');
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file]);

  const reportProgress = useCallback(
    (current: number, total: number, label: string) => {
      const percent = total > 0 ? Math.round((current / total) * 100) : 0;
      onProcessingChange(true, label, percent);
    },
    [onProcessingChange]
  );

  const handleExtract = useCallback(async () => {
    if (pageCount < 1) {
      setError('Could not read page count from this PDF.');
      return;
    }

    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Extracting pages…', 0);

    try {
      const { bytes, pageIndices, downloadName } = await splitPdfInBrowser(
        file,
        rangeInput,
        pageCount,
        ({ current, total, label }) => reportProgress(current, total, label)
      );

      triggerPdfDownload(bytes, downloadName, '_extracted');
      onProcessingChange(false, '', 0);
      onSuccess(
        `Split complete — extracted ${pageIndices.length} page(s). Download started.`
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Split failed.');
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [file, onClose, onProcessingChange, onSuccess, pageCount, rangeInput, reportProgress]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="split-pdf-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="split-pdf-title" className="text-lg font-bold text-canvas-text">
              Split PDF
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

        {loadingMeta ? (
          <p className="mt-4 text-sm font-medium leading-relaxed text-slate-200">Reading page count…</p>
        ) : (
          <>
            <p className="mt-4 text-sm font-medium leading-relaxed text-slate-200">
              This PDF has <span className="font-semibold text-canvas-text">{pageCount}</span>{' '}
              page{pageCount === 1 ? '' : 's'}. Enter pages to extract (1-based).
            </p>
            <label className="mt-3 block">
              <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
                Page range
              </span>
              <input
                type="text"
                value={rangeInput}
                onChange={(event) => setRangeInput(event.target.value)}
                placeholder="e.g. 1-3, 5"
                disabled={busy}
                className="mt-1.5 w-full rounded-xl border border-canvas-border px-3 py-2.5 text-sm text-canvas-text outline-none ring-canvas-accent/50/30 focus:border-canvas-accent focus:ring-2 disabled:bg-canvas-elevated"
              />
            </label>
            <p className="mt-1.5 text-xs font-medium leading-relaxed text-slate-300">Examples: 1-3, 5, 2-4, 7</p>
          </>
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
            onClick={() => void handleExtract()}
            disabled={busy || loadingMeta || pageCount < 1}
            className="rounded-xl bg-canvas-accent-muted px-4 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Extracting…' : 'Extract & download'}
          </button>
        </div>
      </div>
    </div>
  );
}
