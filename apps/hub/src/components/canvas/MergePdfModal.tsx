import { useCallback, useState } from 'react';
import { formatFileSize } from '../../lib/canvas/documentCanvasStorage';
import {
  isPdfMimeOrName,
  mergePdfsInBrowser,
  triggerPdfDownload,
} from '../../lib/canvas/documentPdfTools';
import { validateUploadFile } from '../../lib/pdf/fileUploadLimits';

interface AdditionalPdf {
  id: string;
  file: File;
  pageCount: number;
}

interface Props {
  canvasFile: File;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

export default function MergePdfModal({
  canvasFile,
  onClose,
  onSuccess,
  onProcessingChange,
}: Props) {
  const [additional, setAdditional] = useState<AdditionalPdf[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const handleAddFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList?.length) return;

    setError(null);
    setAdding(true);

    try {
      const { getPdfPageCountFromFile } = await import('../../lib/pdf/pdfWorkerClient');
      const next: AdditionalPdf[] = [];

      for (const file of Array.from(fileList)) {
        if (!isPdfMimeOrName(file.type, file.name)) {
          setError('Only PDF files can be merged.');
          continue;
        }
        const validation = validateUploadFile(file);
        if (!validation.ok) {
          setError(validation.message);
          continue;
        }
        const pageCount = await getPdfPageCountFromFile(file);
        next.push({ id: crypto.randomUUID(), file, pageCount });
      }

      if (next.length > 0) {
        setAdditional((prev) => [...prev, ...next]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read one of the PDFs.');
    } finally {
      setAdding(false);
    }
  }, []);

  const removeItem = useCallback((id: string) => {
    setAdditional((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const reportProgress = useCallback(
    (current: number, total: number, label: string) => {
      const percent = total > 0 ? Math.round((current / total) * 100) : 0;
      onProcessingChange(true, label, percent);
    },
    [onProcessingChange]
  );

  const handleMerge = useCallback(async () => {
    if (additional.length < 1) {
      setError('Add at least one more PDF to append to the canvas file.');
      return;
    }

    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Preparing merge…', 0);

    const filesInOrder = [canvasFile, ...additional.map((item) => item.file)];

    try {
      const { bytes, downloadName } = await mergePdfsInBrowser(filesInOrder, ({ current, total, label }) =>
        reportProgress(current, total, label)
      );

      triggerPdfDownload(bytes, downloadName, '_merged');
      onProcessingChange(false, '', 0);
      onSuccess(
        `Merge complete — ${filesInOrder.length} PDFs combined. Download started.`
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge failed.');
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [additional, canvasFile, onClose, onProcessingChange, onSuccess, reportProgress]);

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
              Canvas file is first; add PDFs to append after it.
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

        <div className="mt-4 rounded-xl border border-canvas-border bg-canvas-accent-soft px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-canvas-accent">
            Canvas file (first)
          </p>
          <p className="mt-0.5 truncate text-sm font-medium text-canvas-text">{canvasFile.name}</p>
          <p className="text-xs font-medium leading-relaxed text-slate-300">{formatFileSize(canvasFile.size)}</p>
        </div>

        <div className="mt-3 space-y-2">
          {additional.map((item, index) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-canvas-border px-3 py-2.5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-canvas-elevated text-xs font-bold text-canvas-muted">
                {index + 2}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-canvas-text">{item.file.name}</p>
                <p className="text-xs font-medium leading-relaxed text-slate-300">
                  {item.pageCount} page{item.pageCount === 1 ? '' : 's'} ·{' '}
                  {formatFileSize(item.file.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                disabled={busy}
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 transition hover:bg-canvas-danger-soft/30 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-canvas-border px-4 py-5 text-center transition hover:border-emerald-300 hover:bg-canvas-accent-soft/50">
          <span className="text-sm font-semibold text-canvas-muted">
            {adding ? 'Reading PDFs…' : 'Tap to add PDFs to append'}
          </span>
          <span className="mt-1 text-xs font-medium leading-relaxed text-slate-300">Processed locally — nothing uploaded</span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="sr-only"
            disabled={busy || adding}
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
            disabled={busy || additional.length < 1}
            className="rounded-xl bg-canvas-accent-muted px-4 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Merging…' : `Merge & download (${1 + additional.length} PDFs)`}
          </button>
        </div>
      </div>
    </div>
  );
}
