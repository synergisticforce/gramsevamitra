import { useCallback, useState } from 'react';
import JSZip from 'jszip';
import { getBrandedFilename } from '@shared/utils/fileUtils';
import { ActionButton, FileDropZone, SelectedFileStatus, StatusMessage } from './ToolWorkspaceShell';
import { useToolProgress } from './ToolProgressContext';
import { downloadBlob, downloadBytes } from '../../lib/pdfEngine';
import { parsePageRange } from '../../lib/pageRangeParser';
import { toProcessingError } from '../../lib/processingErrors';
import { getPdfPageCountFromFile, runPdfWorkerWithStreamedFile } from '../../lib/pdfWorkerClient';

type SplitMode = 'range' | 'split-all';

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export default function SplitPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<SplitMode>('range');
  const [rangeInput, setRangeInput] = useState('1-3, 5');
  const [pageCount, setPageCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { report, resetProgress, setProgress } = useToolProgress();

  const handleFile = useCallback(async (files: File[]) => {
    const selected = files[0] ?? null;
    setFile(selected);
    setError(null);
    setSuccess(null);
    setPageCount(0);

    if (!selected) return;

    try {
      const count = await getPdfPageCountFromFile(selected);
      setPageCount(count);
      setRangeInput(count === 1 ? '1' : `1-${Math.min(3, count)}`);
    } catch (err) {
      setError(toProcessingError(err));
    }
  }, []);

  const extractRange = useCallback(async () => {
    if (!file) {
      setError('Please select a PDF.');
      return;
    }
    if (pageCount < 1) {
      setError('Could not read page count from this PDF.');
      return;
    }

    let pageIndices: number[];
    try {
      pageIndices = parsePageRange(rangeInput, pageCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid page range.');
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);
    setProgress({ active: true, percent: 0, label: 'Extracting pages…' });

    try {
      const out = await runPdfWorkerWithStreamedFile<Uint8Array>(
        'extract',
        file,
        { pageIndices },
        ({ current, total, label }) => report(current, total, label)
      );

      const baseName = file.name.replace(/\.pdf$/i, '');
      const rawName = `${baseName}-pages-${rangeInput.replace(/\s+/g, '')}.pdf`;
      downloadBytes(out, rawName, 'application/pdf', '_extracted');
      setSuccess(
        `Extracted ${pageIndices.length} page(s) (${pageIndices.map((i) => i + 1).join(', ')}) · ${formatFileSize(out.length)}.`
      );
    } catch (err) {
      setError(toProcessingError(err));
    } finally {
      resetProgress();
      setBusy(false);
    }
  }, [file, pageCount, rangeInput, report, resetProgress, setProgress]);

  const splitAll = useCallback(async () => {
    if (!file) {
      setError('Please select a PDF.');
      return;
    }
    if (pageCount < 1) {
      setError('Could not read page count from this PDF.');
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);
    setProgress({ active: true, percent: 0, label: 'Splitting all pages…' });

    try {
      const pages = await runPdfWorkerWithStreamedFile<Uint8Array[]>(
        'split-all-pages',
        file,
        {},
        ({ current, total, label }) => report(current, total, label)
      );

      const zip = new JSZip();
      const baseName = file.name.replace(/\.pdf$/i, '');
      pages.forEach((bytes, index) => {
        const rawName = `${baseName}-page-${index + 1}.pdf`;
        zip.file(getBrandedFilename(rawName, '_split'), bytes);
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(zipBlob, `${baseName}-all-pages.zip`, '_export');
      setSuccess(`Split ${pages.length} individual page PDF(s) into a ZIP archive.`);
    } catch (err) {
      setError(toProcessingError(err));
    } finally {
      resetProgress();
      setBusy(false);
    }
  }, [file, pageCount, report, resetProgress, setProgress]);

  const run = mode === 'range' ? extractRange : splitAll;

  return (
    <div className="space-y-4">
      <FileDropZone accept="application/pdf" label="Select PDF to split or extract" onFiles={handleFile} />
      <SelectedFileStatus file={file} />
      {file && pageCount > 0 && (
        <p className="text-sm text-slate-400">
          {file.name} · {pageCount} page(s) · {formatFileSize(file.size)}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setMode('range');
            setError(null);
            setSuccess(null);
          }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            mode === 'range'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          Extract Custom Range
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('split-all');
            setError(null);
            setSuccess(null);
          }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            mode === 'split-all'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          Split All Pages
        </button>
      </div>

      {mode === 'range' ? (
        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
          <label className="block">
            <span className="label text-emerald-200">Page range</span>
            <input
              type="text"
              value={rangeInput}
              onChange={(e) => {
                setRangeInput(e.target.value);
                setError(null);
                setSuccess(null);
              }}
              placeholder="e.g. 1-3, 5, 8-10"
              className="input-field border-emerald-800/60 bg-[#064e3b]/20 focus:border-emerald-400"
            />
          </label>
          <p className="mt-2 text-xs text-slate-500">
            Use commas for separate selections and hyphens for ranges. Pages are 1-based.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-100">
          Each page will be exported as its own PDF inside a ZIP file — ideal for sharing single pages.
        </div>
      )}

      <ActionButton onClick={run} disabled={busy || !file || pageCount < 1}>
        {busy
          ? 'Processing…'
          : mode === 'range'
            ? 'Extract Pages & Download'
            : 'Split All & Download ZIP'}
      </ActionButton>
      <StatusMessage error={error} success={success} />
    </div>
  );
}
