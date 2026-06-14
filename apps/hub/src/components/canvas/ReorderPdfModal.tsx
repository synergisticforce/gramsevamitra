import { useCallback, useEffect, useState } from 'react';
import { reorderPdfPagesInBrowser, triggerPdfDownload } from '../../lib/canvas/documentPdfTools';

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
      className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reorder-pdf-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="reorder-pdf-title" className="text-lg font-bold text-slate-900">
              Reorder PDF Pages
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

        {loadingMeta ? (
          <p className="mt-4 text-sm text-slate-500">Reading page count…</p>
        ) : (
          <>
            <p className="mt-4 text-sm text-slate-600">
              Use the arrows to rearrange pages. The list shows the new output order.
            </p>
            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {pageOrder.map((pageIndex, position) => (
                <li
                  key={`${pageIndex}-${position}`}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <span className="text-sm text-slate-800">
                    <span className="font-semibold text-emerald-700">{position + 1}.</span> Page{' '}
                    {pageIndex + 1}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={busy || position === 0}
                      onClick={() => movePage(position, -1)}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-white disabled:opacity-40"
                      aria-label={`Move page ${pageIndex + 1} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={busy || position === pageOrder.length - 1}
                      onClick={() => movePage(position, 1)}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-white disabled:opacity-40"
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
            disabled={busy || loadingMeta || pageCount < 1}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save order & download'}
          </button>
        </div>
      </div>
    </div>
  );
}
