import { useCallback, useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import { getBrandedFilename } from '@shared/utils/fileUtils';
import { ActionButton, FileDropZone, StatusMessage } from './ToolWorkspaceShell';
import { useToolProgress } from './ToolProgressContext';
import VisualPageGrid from '../shared/VisualPageGrid';
import { usePdfDocument } from '../../hooks/usePdfDocument';
import { downloadBlob, downloadBytes } from '../../lib/pdfEngine';
import { initVisualPageState } from '../../lib/visualToolHelpers';
import {
  DEFAULT_SPLIT_GROUPS,
  EXTRA_GROUP_STYLES,
  type PageGroup,
  type PageVisualState,
} from '../../lib/visualPageTypes';
import { toProcessingError } from '../../lib/processingErrors';
import { runPdfWorkerWithStreamedFile } from '../../lib/pdfWorkerClient';

export default function SplitPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [groups, setGroups] = useState<PageGroup[]>(DEFAULT_SPLIT_GROUPS);
  const [activeGroupId, setActiveGroupId] = useState<string>(DEFAULT_SPLIT_GROUPS[0].id);
  const [pageStates, setPageStates] = useState<PageVisualState[]>([]);
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const lastClickedRef = useRef<number | null>(null);
  const { pdf, loading, error: pdfError, numPages } = usePdfDocument(file);
  const { report, resetProgress } = useToolProgress();

  useEffect(() => {
    if (numPages > 0) {
      const init = initVisualPageState(numPages);
      setPageStates(init.pageStates);
      setPageOrder(init.pageOrder);
      lastClickedRef.current = null;
    } else {
      setPageStates([]);
      setPageOrder([]);
    }
  }, [numPages]);

  const addGroup = () => {
    const idx = groups.length;
    const style = EXTRA_GROUP_STYLES[(idx - 2) % EXTRA_GROUP_STYLES.length];
    const id = `group-${idx + 1}`;
    setGroups((prev) => [
      ...prev,
      { id, label: `Group ${idx + 1}`, borderClass: style.borderClass, badgeClass: style.badgeClass },
    ]);
    setActiveGroupId(id);
  };

  const assignRange = (from: number, to: number, groupId: string) => {
    const start = Math.min(from, to);
    const end = Math.max(from, to);
    setPageStates((prev) =>
      prev.map((s) => (s.pageNum >= start && s.pageNum <= end ? { ...s, groupId } : s))
    );
  };

  const handlePageClick = (pageNum: number, shiftKey: boolean) => {
    if (shiftKey && lastClickedRef.current != null) {
      assignRange(lastClickedRef.current, pageNum, activeGroupId);
    }
    lastClickedRef.current = pageNum;
  };

  const extract = useCallback(async () => {
    if (!file || !pdf) {
      setError('Please select a PDF.');
      return;
    }

    const grouped = groups
      .map((group) => ({
        group,
        pages: pageStates
          .filter((s) => s.groupId === group.id)
          .map((s) => s.pageNum - 1)
          .sort((a, b) => a - b),
      }))
      .filter((g) => g.pages.length > 0);

    if (grouped.length === 0) {
      setError('Assign at least one page to a group by tapping thumbnails.');
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const outputs: { name: string; rawName: string; bytes: Uint8Array }[] = [];

      for (let i = 0; i < grouped.length; i++) {
        const { group, pages } = grouped[i];
        report(i, grouped.length, `Extracting ${group.label}…`);
        const out = await runPdfWorkerWithStreamedFile<Uint8Array>(
          'extract',
          file,
          { pageIndices: pages },
          ({ current, total, label }) => report(current, total, label)
        );
        const baseName = file.name.replace(/\.pdf$/i, '');
        const rawName = `${baseName}-${group.label}.pdf`;
        outputs.push({
          name: getBrandedFilename(rawName, '_extracted'),
          bytes: out,
          rawName,
        });
      }

      if (outputs.length === 1) {
        downloadBytes(outputs[0].bytes, outputs[0].rawName, 'application/pdf', '_extracted');
        setSuccess(`Extracted ${grouped[0].pages.length} page(s) to ${outputs[0].name}.`);
      } else {
        const zip = new JSZip();
        outputs.forEach(({ name, bytes }) => zip.file(name, bytes));
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const zipName = file.name.replace(/\.pdf$/i, '-split-groups.zip');
        downloadBlob(zipBlob, zipName, '_export');
        setSuccess(`Created ${outputs.length} branded PDFs inside a ZIP archive.`);
      }
    } catch (err) {
      setError(toProcessingError(err));
    } finally {
      resetProgress();
      setBusy(false);
    }
  }, [file, pdf, groups, pageStates, report, resetProgress]);

  const assignedCount = pageStates.filter((s) => s.groupId).length;

  return (
    <div className="space-y-4">
      <FileDropZone
        accept="application/pdf"
        label="Select PDF for multi-group visual split"
        onFiles={(f) => setFile(f[0] ?? null)}
      />

      {loading && <p className="text-center text-sm text-emerald-200">Loading page previews…</p>}
      <StatusMessage error={pdfError ?? error} success={success} />

      {pdf && pageOrder.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => setActiveGroupId(group.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  activeGroupId === group.id
                    ? `${group.borderClass} ${group.badgeClass} ring-2 ring-white/20`
                    : 'border-slate-700 text-slate-400 hover:border-emerald-700'
                }`}
              >
                {group.label}
              </button>
            ))}
            <button
              type="button"
              onClick={addGroup}
              className="rounded-full border border-dashed border-emerald-700 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-950/40"
            >
              + Add Group
            </button>
          </div>

          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
            Active: {groups.find((g) => g.id === activeGroupId)?.label} · Tap to assign · Shift+tap
            for range · {assignedCount} pages assigned
          </p>

          <VisualPageGrid
            pdf={pdf}
            mode="group-select"
            pageStates={pageStates}
            pageOrder={pageOrder}
            groups={groups}
            activeGroupId={activeGroupId}
            onPageOrderChange={setPageOrder}
            onPageStatesChange={setPageStates}
            onPageClick={handlePageClick}
          />
        </>
      )}

      <ActionButton onClick={extract} disabled={busy || !file || !pdf || assignedCount === 0}>
        {busy ? 'Extracting…' : 'Extract Groups & Download'}
      </ActionButton>
    </div>
  );
}
