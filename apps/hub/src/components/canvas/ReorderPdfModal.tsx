import { useCallback, useEffect, useState } from 'react';
import { reorderPdfPagesInBrowser, triggerPdfDownload } from '../../lib/canvas/documentPdfTools';
import { requiresChunkedPipeline } from '../../lib/pdf/fileUploadLimits';
import { runChunkedReorderPipeline } from '../../lib/upload/chunkedPipeline';
import { useModalMetaLoading } from '../../lib/canvas/useModalMetaLoading';
import ToolProcessingWait from './ToolProcessingWait';

interface Props {
  file: File;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

export default function ReorderPdfModal({ file, onClose, onSuccess, onProcessingChange }: Props) {
  const [pageCount, setPageCount] = useState(0);
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useModalMetaLoading(loadingMeta, busy, onProcessingChange, 'Reading page count… Please wait');

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
        setPageOrder(Array.from({ length: count }, (_, i) => i));
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

  const movePage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= pageOrder.length) return;
    setPageOrder((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

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
    onProcessingChange(true, 'Reordering pages…', 0);

    try {
      if (requiresChunkedPipeline(file)) {
        await runChunkedReorderPipeline(file, pageOrder, ({ label, percent }) =>
          onProcessingChange(true, label, percent),
        );
        onProcessingChange(false, '', 0);
        onSuccess('Pages reordered via Smart Slicing — download started.');
        onClose();
        return;
      }

      const { bytes, downloadName } = await reorderPdfPagesInBrowser(
        file,
        pageOrder,
        ({ current, total, label }) => reportProgress(current, total, label)
      );
      triggerPdfDownload(bytes, downloadName, '_reordered');
      onProcessingChange(false, '', 0);
      onSuccess('Pages reordered — download started.');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reorder failed.');
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [file, onClose, onProcessingChange, onSuccess, pageOrder, reportProgress]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reorder-pdf-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="reorder-pdf-title" className="text-lg font-bold text-canvas-text">
              Reorder PDF Pages
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
          <ToolProcessingWait label="Reading page count…" className="mt-4" />
        ) : (
          <>
            <p className="mt-4 text-sm font-medium leading-relaxed text-slate-200">
              Use the arrows to rearrange pages. The list shows the new output order.
            </p>
            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {pageOrder.map((pageIndex, position) => (
                <li
                  key={`${pageIndex}-${position}`}
                  className="flex items-center justify-between rounded-xl border border-canvas-border bg-canvas-elevated px-3 py-2"
                >
                  <span className="text-sm text-canvas-text">
                    <span className="font-semibold text-canvas-accent">{position + 1}.</span> Page{' '}
                    {pageIndex + 1}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={busy || position === 0}
                      onClick={() => movePage(position, -1)}
                      className="rounded-lg border border-canvas-border px-2 py-1 text-xs font-semibold text-canvas-muted hover:bg-canvas-surface disabled:opacity-40"
                      aria-label={`Move page ${pageIndex + 1} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={busy || position === pageOrder.length - 1}
                      onClick={() => movePage(position, 1)}
                      className="rounded-lg border border-canvas-border px-2 py-1 text-xs font-semibold text-canvas-muted hover:bg-canvas-surface disabled:opacity-40"
                      aria-label={`Move page ${pageIndex + 1} down`}
                    >
                      ↓
                    </button>
                  </div>
                </li>
              ))}
            </ul>
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
            onClick={() => void handleApply()}
            disabled={busy || loadingMeta || pageCount < 1}
            className="rounded-xl bg-canvas-accent-muted px-4 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save order & download'}
          </button>
        </div>
      </div>
    </div>
  );
}
