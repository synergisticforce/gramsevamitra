import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActionButton, FileDropZone, StatusMessage } from './ToolWorkspaceShell';
import { useToolProgress } from './ToolProgressContext';
import VisualPageGrid from '../shared/VisualPageGrid';
import { usePdfDocument } from '../../hooks/usePdfDocument';
import { downloadBytes } from '../../lib/pdfEngine';
import { initVisualPageState } from '../../lib/visualToolHelpers';
import type { PageVisualState } from '../../lib/visualPageTypes';
import { runPdfWorkerWithStreamedFile } from '../../lib/pdfWorkerClient';

export default function OrganizePdfTool() {
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

  const stateByPage = useMemo(() => new Map(pageStates.map((s) => [s.pageNum, s])), [pageStates]);

  const exportPdf = useCallback(async () => {
    if (!file) {
      setError('Please select a PDF.');
      return;
    }

    const orderedIndices = pageOrder
      .filter((pageNum) => !stateByPage.get(pageNum)?.removed)
      .map((pageNum) => pageNum - 1);

    if (orderedIndices.length === 0) {
      setError('Keep at least one page in the document.');
      return;
    }

    const rotations = pageStates
      .filter((s) => !s.removed && s.rotation > 0)
      .map((s) => ({ pageIndex: s.pageNum - 1, angle: s.rotation }));

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const out = await runPdfWorkerWithStreamedFile<Uint8Array>(
        'organize-pages',
        file,
        { orderedIndices, rotations },
        ({ current, total, label }) => report(current, total, label)
      );
      downloadBytes(out, file.name, 'application/pdf', '_organized');
      setSuccess(`Organized PDF saved (${orderedIndices.length} pages).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Organize failed.');
    } finally {
      resetProgress();
      setBusy(false);
    }
  }, [file, pageOrder, pageStates, stateByPage, report, resetProgress]);

  const removedCount = pageStates.filter((s) => s.removed).length;

  return (
    <div className="space-y-4">
      <FileDropZone
        accept="application/pdf"
        label="Select PDF to organize visually"
        onFiles={(f) => setFile(f[0] ?? null)}
      />

      {loading && <p className="text-center text-sm text-emerald-200">Loading page previews…</p>}
      <StatusMessage error={pdfError ?? error} success={success} />

      {pdf && pageOrder.length > 0 && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
            Drag to reorder · Tap page to rotate · 🗑 to remove · {removedCount} marked for removal
          </p>
          <VisualPageGrid
            pdf={pdf}
            mode="organize"
            pageStates={pageStates}
            pageOrder={pageOrder}
            onPageOrderChange={setPageOrder}
            onPageStatesChange={setPageStates}
          />
        </>
      )}

      <ActionButton onClick={exportPdf} disabled={busy || !file || !pdf}>
        {busy ? 'Organizing…' : 'Save Organized PDF'}
      </ActionButton>
    </div>
  );
}
