import { useCallback, useEffect, useState } from 'react';
import { ActionButton, FileDropZone, StatusMessage } from './ToolWorkspaceShell';
import { useToolProgress } from './ToolProgressContext';
import VisualPageGrid from '../shared/VisualPageGrid';
import { usePdfDocument } from '../../hooks/usePdfDocument';
import { downloadBytes } from '../../lib/pdfEngine';
import { initVisualPageState } from '../../lib/visualToolHelpers';
import type { PageVisualState } from '../../lib/visualPageTypes';
import { runPdfWorkerWithStreamedFile } from '../../lib/pdfWorkerClient';

export default function ReorderPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pageStates, setPageStates] = useState<PageVisualState[]>([]);
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { pdf, loading, error: pdfError, numPages } = usePdfDocument(file);
  const { report, resetProgress } = useToolProgress();

  useEffect(() => {
    if (numPages > 0) {
      const init = initVisualPageState(numPages);
      setPageStates(init.pageStates);
      setPageOrder(init.pageOrder);
    } else {
      setPageStates([]);
      setPageOrder([]);
    }
  }, [numPages]);

  const run = useCallback(async () => {
    if (!file) {
      setError('Please select a PDF.');
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const order = pageOrder.map((pageNum) => pageNum - 1);
      const out = await runPdfWorkerWithStreamedFile<Uint8Array>(
        'reorder-pages',
        file,
        { order },
        ({ current, total, label }) => report(current, total, label)
      );
      downloadBytes(out, file.name, 'application/pdf', '_reordered');
      setSuccess('Pages reordered successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reorder failed.');
    } finally {
      resetProgress();
      setBusy(false);
    }
  }, [file, pageOrder, report, resetProgress]);

  return (
    <div className="space-y-4">
      <FileDropZone
        accept="application/pdf"
        label="Select PDF to drag-reorder pages"
        onFiles={(f) => setFile(f[0] ?? null)}
      />

      {loading && <p className="text-center text-sm text-emerald-200">Loading page previews…</p>}
      <StatusMessage error={pdfError ?? error} success={success} />

      {pdf && pageOrder.length > 0 && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
            Drag thumbnails to rearrange page order
          </p>
          <VisualPageGrid
            pdf={pdf}
            mode="reorder"
            pageStates={pageStates}
            pageOrder={pageOrder}
            onPageOrderChange={setPageOrder}
            onPageStatesChange={setPageStates}
          />
        </>
      )}

      <ActionButton onClick={run} disabled={busy || !file || !pdf}>
        {busy ? 'Saving…' : 'Save New Order & Download'}
      </ActionButton>
    </div>
  );
}
