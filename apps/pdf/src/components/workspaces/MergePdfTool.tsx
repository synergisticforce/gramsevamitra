import { useCallback, useMemo, useState } from 'react';
import { ActionButton, FileDropZone, StatusMessage } from './ToolWorkspaceShell';
import { useToolProgress } from './ToolProgressContext';
import VisualFileGrid, { type MergeFileItem } from '../shared/VisualFileGrid';
import { downloadBytes } from '../../lib/pdfEngine';
import { toProcessingError } from '../../lib/processingErrors';
import { getPdfPageCountFromFile, runPdfWorker } from '../../lib/pdfWorkerClient';

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export default function MergePdfTool() {
  const [items, setItems] = useState<MergeFileItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { report, resetProgress, setProgress } = useToolProgress();

  const totals = useMemo(() => {
    const pages = items.reduce((sum, item) => sum + item.pageCount, 0);
    const bytes = items.reduce((sum, item) => sum + item.file.size, 0);
    return { pages, bytes };
  }, [items]);

  const addFiles = useCallback(async (files: File[]) => {
    setError(null);
    setSuccess(null);
    const pdfs = files.filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (pdfs.length === 0) {
      setError('Please select valid PDF files.');
      return;
    }

    const next: MergeFileItem[] = [];
    try {
      for (const file of pdfs) {
        const pageCount = await getPdfPageCountFromFile(file);
        next.push({ id: crypto.randomUUID(), file, pageCount });
      }
      setItems((prev) => [...prev, ...next]);
    } catch (err) {
      setError(toProcessingError(err));
    }
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
    setSuccess(null);
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
    setError(null);
    setSuccess(null);
  }, []);

  const merge = useCallback(async () => {
    if (items.length < 2) {
      setError('Add at least two PDF files to merge.');
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);
    setProgress({ active: true, percent: 0, label: 'Preparing files…' });

    try {
      const buffers: ArrayBuffer[] = [];
      for (let i = 0; i < items.length; i++) {
        report(i, items.length, `Reading file ${i + 1} of ${items.length}…`);
        buffers.push(await items[i].file.arrayBuffer());
      }

      const out = await runPdfWorker<Uint8Array>(
        'merge',
        { buffers },
        ({ current, total, label }) => report(current, total, label)
      );

      downloadBytes(out, 'merged-document.pdf', 'application/pdf', '_merged');
      setSuccess(
        `Merged ${items.length} PDFs in your chosen order (${totals.pages} pages · ${formatFileSize(out.length)}).`
      );
    } catch (err) {
      setError(toProcessingError(err));
    } finally {
      resetProgress();
      setBusy(false);
    }
  }, [items, report, resetProgress, setProgress, totals.pages]);

  return (
    <div className="space-y-4">
      <FileDropZone
        accept="application/pdf"
        multiple
        label="Drop PDFs here or tap to add multiple files"
        onFiles={addFiles}
      />

      {items.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                Merge order · drag thumbnails to reorder
              </p>
              <p className="mt-1 text-sm text-slate-300">
                {items.length} file(s) · {totals.pages} pages · {formatFileSize(totals.bytes)} input
              </p>
            </div>
            <button
              type="button"
              onClick={clearAll}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:border-red-800 hover:text-red-300"
            >
              Clear all
            </button>
          </div>

          <VisualFileGrid items={items} onOrderChange={setItems} onRemove={removeItem} />

          <FileDropZone
            accept="application/pdf"
            multiple
            label="Add more PDFs to the merge queue"
            onFiles={addFiles}
          />
        </>
      )}

      <ActionButton onClick={merge} disabled={busy || items.length < 2}>
        {busy ? 'Merging…' : 'Merge in this order & Download'}
      </ActionButton>
      <StatusMessage error={error} success={success} />
    </div>
  );
}
