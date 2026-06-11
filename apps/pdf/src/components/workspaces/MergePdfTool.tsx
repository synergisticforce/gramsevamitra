import { useCallback, useState } from 'react';
import { ActionButton, FileDropZone, StatusMessage } from './ToolWorkspaceShell';
import { useToolProgress } from './ToolProgressContext';
import VisualFileGrid, { type MergeFileItem } from '../shared/VisualFileGrid';
import { downloadBytes } from '../../lib/pdfEngine';
import { toProcessingError } from '../../lib/processingErrors';
import { getPdfPageCountFromFile, runPdfWorker } from '../../lib/pdfWorkerClient';

export default function MergePdfTool() {
  const [items, setItems] = useState<MergeFileItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { report, resetProgress, setProgress } = useToolProgress();

  const addFiles = useCallback(async (files: File[]) => {
    setError(null);
    const next: MergeFileItem[] = [];
    try {
      for (const file of files) {
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
  }, []);

  const merge = useCallback(async () => {
    if (items.length < 2) {
      setError('Select at least two PDF files to merge.');
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
      setSuccess(`Merged ${items.length} PDFs (${items.reduce((s, x) => s + x.pageCount, 0)} pages total).`);
    } catch (err) {
      setError(toProcessingError(err));
    } finally {
      resetProgress();
      setBusy(false);
    }
  }, [items, report, resetProgress, setProgress]);

  return (
    <div className="space-y-4">
      <FileDropZone
        accept="application/pdf"
        multiple
        label="Drop PDFs here or tap to add"
        onFiles={addFiles}
      />

      {items.length > 0 && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
            Drag covers to reorder merge sequence · {items.length} file(s)
          </p>
          <VisualFileGrid items={items} onOrderChange={setItems} onRemove={removeItem} />
        </>
      )}

      <ActionButton onClick={merge} disabled={busy || items.length < 2}>
        {busy ? 'Merging…' : 'Merge & Download'}
      </ActionButton>
      <StatusMessage error={error} success={success} />
    </div>
  );
}
