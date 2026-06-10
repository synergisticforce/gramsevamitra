import { useCallback, useEffect, useState } from 'react';
import { ActionButton, FileDropZone, StatusMessage } from './ToolWorkspaceShell';
import { useToolProgress } from './ToolProgressContext';
import VisualPageGrid from '../shared/VisualPageGrid';
import { usePdfDocument } from '../../hooks/usePdfDocument';
import { downloadBytes } from '../../lib/pdfEngine';
import { initVisualPageState } from '../../lib/visualToolHelpers';
import type { PageVisualState } from '../../lib/visualPageTypes';
import { runPdfWorkerWithStreamedFile } from '../../lib/pdfWorkerClient';

export default function RemovePagesTool() {
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

  const removedCount = pageStates.filter((s) => s.removed).length;

  const run = useCallback(async () => {
    if (!file) {
      setError('Please select a PDF.');
      return;
    }

    const removeIndices = pageStates.filter((s) => s.removed).map((s) => s.pageNum - 1);
    if (removeIndices.length === 0) {
      setError('Tap 🗑 on pages to mark them for removal.');
      return;
    }
    if (removeIndices.length >= pageStates.length) {
      setError('Cannot remove every page — keep at least one.');
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const out = await runPdfWorkerWithStreamedFile<Uint8Array>(
        'remove-pages',
        file,
        { removeIndices },
        ({ current, total, label }) => report(current, total, label)
      );
      downloadBytes(out, file.name, 'application/pdf', '_pages-removed');
      setSuccess(`Removed ${removeIndices.length} page(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Removal failed.');
    } finally {
      resetProgress();
      setBusy(false);
    }
  }, [file, pageStates, report, resetProgress]);

  return (
    <div className="space-y-4">
      <FileDropZone
        accept="application/pdf"
        label="Select PDF to remove pages visually"
        onFiles={(f) => setFile(f[0] ?? null)}
      />

      {loading && <p className="text-center text-sm text-emerald-200">Loading page previews…</p>}
      <StatusMessage error={pdfError ?? error} success={success} />

      {pdf && pageOrder.length > 0 && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
            Tap 🗑 to mark pages for removal · {removedCount} marked
          </p>
          <VisualPageGrid
            pdf={pdf}
            mode="remove"
            pageStates={pageStates}
            pageOrder={pageOrder}
            onPageOrderChange={setPageOrder}
            onPageStatesChange={setPageStates}
          />
        </>
      )}

      <ActionButton onClick={run} disabled={busy || !file || !pdf || removedCount === 0}>
        {busy ? 'Processing…' : 'Remove Marked Pages & Download'}
      </ActionButton>
    </div>
  );
}
