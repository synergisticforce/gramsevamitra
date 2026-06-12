import { useCallback, useState } from 'react';
import { ActionButton, FileDropZone, SelectedFileStatus, StatusMessage } from './ToolWorkspaceShell';
import { useToolProgress } from './ToolProgressContext';
import { downloadBytes } from '../../lib/pdfEngine';
import {
  metadataHasValues,
  readPdfMetadata,
  type PdfMetadataInfo,
} from '../../lib/pdfMetadata';
import { toProcessingError } from '../../lib/processingErrors';
import { runPdfWorkerWithStreamedFile } from '../../lib/pdfWorkerClient';

const METADATA_LABELS: { key: keyof PdfMetadataInfo; label: string }[] = [
  { key: 'title', label: 'Title' },
  { key: 'author', label: 'Author' },
  { key: 'subject', label: 'Subject' },
  { key: 'keywords', label: 'Keywords' },
  { key: 'creator', label: 'Creator' },
  { key: 'producer', label: 'Software / Producer' },
  { key: 'creationDate', label: 'Created' },
  { key: 'modificationDate', label: 'Modified' },
];

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export default function RemoveMetadataTool() {
  const [file, setFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<PdfMetadataInfo | null>(null);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { report, resetProgress } = useToolProgress();

  const handleFile = useCallback(async (files: File[]) => {
    const selected = files[0] ?? null;
    setFile(selected);
    setMetadata(null);
    setError(null);
    setSuccess(null);

    if (!selected) return;

    setScanning(true);
    try {
      const meta = await readPdfMetadata(selected);
      setMetadata(meta);
    } catch (err) {
      setError(toProcessingError(err));
    } finally {
      setScanning(false);
    }
  }, []);

  const strip = useCallback(async () => {
    if (!file) {
      setError('Select a PDF first.');
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const originalBytes = file.size;
      const out = await runPdfWorkerWithStreamedFile<Uint8Array>(
        'strip-metadata',
        file,
        {},
        ({ current, total, label }) => report(current, total, label)
      );
      downloadBytes(out, file.name, 'application/pdf', '_metadata-stripped');
      const saved = Math.max(0, originalBytes - out.length);
      setSuccess(
        `Metadata stripped · ${formatFileSize(originalBytes)} → ${formatFileSize(out.length)}${
          saved > 0 ? ` · saved ${formatFileSize(saved)}` : ''
        }.`
      );
      setMetadata({
        title: '',
        author: '',
        subject: '',
        keywords: '',
        creator: '',
        producer: '',
        creationDate: null,
        modificationDate: null,
      });
    } catch (err) {
      setError(toProcessingError(err));
    } finally {
      resetProgress();
      setBusy(false);
    }
  }, [file, report, resetProgress]);

  const hasMetadata = metadata ? metadataHasValues(metadata) : false;

  return (
    <div className="space-y-4">
      <FileDropZone
        accept="application/pdf"
        label="Upload PDF to inspect and strip hidden metadata"
        onFiles={handleFile}
      />
      <SelectedFileStatus file={file} />

      {scanning && (
        <p className="text-sm text-emerald-200" role="status">
          Reading document properties…
        </p>
      )}

      {metadata && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <h3 className="text-sm font-semibold text-white">Here is what we found</h3>
          <p className="mt-1 text-xs text-slate-500">
            Hidden author, software, and timestamp fields embedded in this PDF.
          </p>

          {hasMetadata ? (
            <ul className="mt-4 space-y-2">
              {METADATA_LABELS.map(({ key, label }) => {
                const value = metadata[key];
                if (!value) return null;
                return (
                  <li
                    key={key}
                    className="flex flex-col gap-0.5 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
                    <span className="text-sm text-slate-200 sm:max-w-[65%] sm:text-right">{value}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-400">
              No standard metadata fields were detected. You can still strip hidden dictionary entries and
              document history.
            </p>
          )}
        </div>
      )}

      <ActionButton onClick={strip} disabled={busy || !file || scanning}>
        {busy ? 'Stripping…' : 'Strip Metadata & Download'}
      </ActionButton>
      <StatusMessage error={error} success={success} />
    </div>
  );
}
