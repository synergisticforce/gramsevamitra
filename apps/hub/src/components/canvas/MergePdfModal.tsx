import { useCallback, useEffect, useState } from 'react';
import { formatFileSize } from '../../lib/canvas/documentCanvasStorage';
import {
  isPdfMimeOrName,
  mergePdfsInBrowser,
  triggerPdfDownload,
} from '../../lib/canvas/documentPdfTools';
import { requiresChunkedPipeline, validateUploadFile } from '../../lib/pdf/fileUploadLimits';
import { runChunkedMergePipeline } from '../../lib/upload/chunkedPipeline';
import ToolProcessingWait from './ToolProcessingWait';

interface QueueItem {
  id: string;
  file: File;
  pageCount: number;
}

interface Props {
  /** Canvas file when opened from toolbar (legacy: first in merge order). */
  canvasFile?: File;
  /** Full merge queue when opened from multi-file drop (all items reorderable). */
  initialQueue?: File[];
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

async function buildQueueFromFiles(files: File[]): Promise<QueueItem[]> {
  const { getPdfPageCountFromFile } = await import('../../lib/pdf/pdfWorkerClient');
  const next: QueueItem[] = [];

  for (const file of files) {
    if (!isPdfMimeOrName(file.type, file.name)) {
      throw new Error('Only PDF files can be merged.');
    }
    const validation = validateUploadFile(file);
    if (!validation.ok) {
      throw new Error(validation.message);
    }
    const pageCount = await getPdfPageCountFromFile(file);
    next.push({ id: crypto.randomUUID(), file, pageCount });
  }

  return next;
}

export default function MergePdfModal({
  canvasFile,
  initialQueue,
  onClose,
  onSuccess,
  onProcessingChange,
}: Props) {
  const queueMode = Boolean(initialQueue?.length);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [hydrating, setHydrating] = useState(queueMode);

  useEffect(() => {
    if (!queueMode && canvasFile) {
      void (async () => {
        setHydrating(true);
        setError(null);
        onProcessingChange(true, 'Reading PDF…', 10);
        try {
          const items = await buildQueueFromFiles([canvasFile]);
          setQueue(items);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not read PDF.');
        } finally {
          setHydrating(false);
          onProcessingChange(false, '', 0);
        }
      })();
      return;
    }

    if (!initialQueue?.length) return;

    let cancelled = false;
    void (async () => {
      setHydrating(true);
      setError(null);
      onProcessingChange(true, 'Reading PDFs…', 10);
      try {
        const items = await buildQueueFromFiles(initialQueue);
        if (!cancelled) setQueue(items);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not read one of the PDFs.');
        }
      } finally {
        if (!cancelled) {
          setHydrating(false);
          onProcessingChange(false, '', 0);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canvasFile, initialQueue, onProcessingChange, queueMode]);

  const handleAddFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList?.length) return;

      setError(null);
      setAdding(true);
      onProcessingChange(true, 'Reading PDFs… Please wait', 15);

      try {
        const next = await buildQueueFromFiles(Array.from(fileList));
        setQueue((prev) => [...prev, ...next]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not read one of the PDFs.');
      } finally {
        setAdding(false);
        onProcessingChange(false, '', 0);
      }
    },
    [onProcessingChange],
  );

  const removeItem = useCallback((id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const moveItem = useCallback((id: string, direction: -1 | 1) => {
    setQueue((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index < 0) return prev;
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }, []);

  const reportProgress = useCallback(
    (current: number, total: number, label: string) => {
      const percent = total > 0 ? Math.round((current / total) * 100) : 0;
      onProcessingChange(true, label, percent);
    },
    [onProcessingChange],
  );

  const handleMerge = useCallback(async () => {
    if (queue.length < 2) {
      setError('Add at least two PDFs to merge.');
      return;
    }

    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Preparing merge…', 0);

    const filesInOrder = queue.map((item) => item.file);

    try {
      if (filesInOrder.some((item) => requiresChunkedPipeline(item))) {
        await runChunkedMergePipeline(filesInOrder, ({ label, percent }) =>
          onProcessingChange(true, label, percent),
        );
        onProcessingChange(false, '', 0);
        onSuccess(
          `Merge complete — ${filesInOrder.length} PDFs combined with Smart Slicing. Download started.`,
        );
        onClose();
        return;
      }

      const { bytes, downloadName } = await mergePdfsInBrowser(filesInOrder, ({ current, total, label }) =>
        reportProgress(current, total, label),
      );

      triggerPdfDownload(bytes, downloadName, '_merged');
      onProcessingChange(false, '', 0);
      onSuccess(`Merge complete — ${filesInOrder.length} PDFs combined. Download started.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge failed.');
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [onClose, onProcessingChange, onSuccess, queue, reportProgress]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="merge-pdf-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="merge-pdf-title" className="text-lg font-bold text-canvas-text">
              Merge PDF
            </h2>
            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-300">
              {queueMode
                ? 'Reorder files below, then merge into one PDF.'
                : 'Canvas file is first — add PDFs or reorder before merging.'}
            </p>
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

        <div className="mt-4 space-y-2">
          {queue.map((item, index) => (
            <div
              key={item.id}
              className="flex items-center gap-2 rounded-xl border border-canvas-border px-3 py-2.5 sm:gap-3"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-canvas-elevated text-xs font-bold text-canvas-muted">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-canvas-text">{item.file.name}</p>
                <p className="text-xs font-medium leading-relaxed text-slate-300">
                  {item.pageCount} page{item.pageCount === 1 ? '' : 's'} ·{' '}
                  {formatFileSize(item.file.size)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  onClick={() => moveItem(item.id, -1)}
                  disabled={busy || index === 0}
                  className="rounded px-1.5 py-0.5 text-xs font-semibold text-canvas-muted transition hover:bg-canvas-elevated disabled:opacity-40"
                  aria-label={`Move ${item.file.name} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(item.id, 1)}
                  disabled={busy || index === queue.length - 1}
                  className="rounded px-1.5 py-0.5 text-xs font-semibold text-canvas-muted transition hover:bg-canvas-elevated disabled:opacity-40"
                  aria-label={`Move ${item.file.name} down`}
                >
                  ↓
                </button>
              </div>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                disabled={busy || queue.length <= 1}
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 transition hover:bg-canvas-danger-soft/30 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        {(adding || hydrating) && (
          <ToolProcessingWait label="Reading PDFs…" className="mt-3" />
        )}

        <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-canvas-border px-4 py-5 text-center transition hover:border-emerald-300 hover:bg-canvas-accent-soft/50">
          <span className="text-sm font-semibold text-canvas-muted">
            {adding ? 'Please wait…' : 'Tap to add more PDFs'}
          </span>
          <span className="mt-1 text-xs font-medium leading-relaxed text-slate-300">
            Small files process locally. Large files auto-switch to Smart Slicing.
          </span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="sr-only"
            disabled={busy || adding || hydrating}
            onChange={(event) => {
              void handleAddFiles(event.target.files);
              event.target.value = '';
            }}
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
            onClick={() => void handleMerge()}
            disabled={busy || hydrating || queue.length < 2}
            className="rounded-xl bg-canvas-accent-muted px-4 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Merging…' : `Merge & download (${queue.length} PDFs)`}
          </button>
        </div>
      </div>
    </div>
  );
}
