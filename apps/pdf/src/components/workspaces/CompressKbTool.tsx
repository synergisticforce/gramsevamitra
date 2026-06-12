import { useCallback, useMemo, useState } from 'react';
import { ActionButton, FileDropZone, StatusMessage } from './ToolWorkspaceShell';
import { useToolProgress } from './ToolProgressContext';
import {
  canvasToJpegBlob,
  downloadBytes,
  loadPdfDocument,
  renderPdfPageToCanvas,
} from '../../lib/pdfEngine';
import { isHeavyDocument } from '../../lib/pdfMemory';
import { toProcessingError } from '../../lib/processingErrors';
import { runPdfWorkerWithJpegPages } from '../../lib/pdfWorkerClient';

type CompressionProfile = 'basic' | 'strong' | 'extreme';

const PROFILES: Record<
  CompressionProfile,
  { quality: number; scale: number; label: string; description: string }
> = {
  basic: {
    quality: 0.88,
    scale: 1,
    label: 'Basic Compression (High Quality)',
    description: 'Best for text-heavy PDFs where sharpness matters most.',
  },
  strong: {
    quality: 0.65,
    scale: 0.85,
    label: 'Strong Compression (Optimal Size)',
    description: 'Balanced quality and file size — recommended for most uploads.',
  },
  extreme: {
    quality: 0.42,
    scale: 0.7,
    label: 'Extreme Compression',
    description: 'Smallest possible size with acceptable readability.',
  },
};

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

async function compressWithJpegPreset(
  file: File,
  quality: number,
  scale: number,
  report: (current: number, total: number, label: string) => void
): Promise<Uint8Array> {
  const pdf = await loadPdfDocument(file);
  return runPdfWorkerWithJpegPages<Uint8Array>(
    pdf.numPages,
    async (pageIndex) => {
      const pageNum = pageIndex + 1;
      report(pageIndex, pdf.numPages, `Optimizing page ${pageNum} of ${pdf.numPages}…`);
      const canvas = await renderPdfPageToCanvas(file, pageNum, scale);
      const jpeg = await canvasToJpegBlob(canvas, quality);
      return new Uint8Array(await jpeg.arrayBuffer());
    },
    ({ current, total, label }) => report(current, total, label)
  );
}

export default function CompressKbTool() {
  const [file, setFile] = useState<File | null>(null);
  const [profile, setProfile] = useState<CompressionProfile>('strong');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    originalBytes: number;
    outputBytes: number;
  } | null>(null);
  const { report, resetProgress, setProgress } = useToolProgress();

  const activeProfile = PROFILES[profile];
  const heavyDocument = file ? isHeavyDocument(file.size) : false;

  const savings = useMemo(() => {
    if (!lastResult) return null;
    const saved = Math.max(0, lastResult.originalBytes - lastResult.outputBytes);
    const pct =
      lastResult.originalBytes > 0
        ? Math.round((saved / lastResult.originalBytes) * 100)
        : 0;
    return { saved, pct };
  }, [lastResult]);

  const compress = useCallback(async () => {
    if (!file) {
      setError('Please select a PDF first.');
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    setLastResult(null);
    setProgress({ active: true, percent: 0, label: 'Analyzing PDF…' });

    try {
      const { quality, scale, label } = PROFILES[profile];
      const out = await compressWithJpegPreset(file, quality, scale, report);
      const originalBytes = file.size;
      const outputBytes = out.length;
      downloadBytes(out, file.name, 'application/pdf', '_compressed');
      setLastResult({ originalBytes, outputBytes });
      const savedKb = Math.max(0, Math.round((originalBytes - outputBytes) / 1024));
      const savedPct = originalBytes > 0 ? Math.round(((originalBytes - outputBytes) / originalBytes) * 100) : 0;
      setSuccess(
        `${label}: ${formatFileSize(originalBytes)} → ${formatFileSize(outputBytes)} · saved ${savedKb} KB (${savedPct}%).`
      );
    } catch (err) {
      setError(toProcessingError(err));
    } finally {
      resetProgress();
      setBusy(false);
    }
  }, [file, profile, report, resetProgress, setProgress]);

  return (
    <div className="space-y-4">
      <FileDropZone accept="application/pdf" label="Drop your PDF here" onFiles={(f) => setFile(f[0] ?? null)} />

      {heavyDocument && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-amber-500/60 bg-amber-950/50 px-4 py-3 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.25)]"
        >
          <span className="mt-0.5 shrink-0 rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-400">
            Heavy Document
          </span>
          <p className="text-sm leading-relaxed text-amber-100/90">
            Heavy Document Detected: Processing runs locally on your phone&apos;s processor. Please
            keep this tab active while your device optimizes the file.
          </p>
        </div>
      )}

      {file && (
        <p className="text-sm text-slate-300">
          Selected: {file.name} ({formatFileSize(file.size)})
        </p>
      )}

      <div className="rounded-xl border border-emerald-900/50 bg-slate-950/60 px-4 py-4">
        <p className="text-sm font-semibold text-white">Compression profile</p>
        <div className="mt-3 space-y-2">
          {(Object.keys(PROFILES) as CompressionProfile[]).map((key) => {
            const item = PROFILES[key];
            const selected = profile === key;
            return (
              <label
                key={key}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition ${
                  selected
                    ? 'border-emerald-500 bg-emerald-950/40'
                    : 'border-slate-700 bg-slate-900/40 hover:border-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="compress-profile"
                  value={key}
                  checked={selected}
                  onChange={() => setProfile(key)}
                  className="mt-1 accent-emerald-500"
                />
                <span>
                  <span className="block text-sm font-medium text-white">{item.label}</span>
                  <span className="mt-0.5 block text-xs text-slate-400">{item.description}</span>
                </span>
              </label>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Active: {activeProfile.label} — quality {Math.round(activeProfile.quality * 100)}%, scale{' '}
          {Math.round(activeProfile.scale * 100)}%.
        </p>
      </div>

      {lastResult && savings && (
        <div className="grid grid-cols-3 gap-3 rounded-xl border border-emerald-800/40 bg-emerald-950/30 p-4 text-center">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Original</p>
            <p className="mt-1 text-sm font-bold tabular-nums text-slate-300">
              {formatFileSize(lastResult.originalBytes)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Compressed</p>
            <p className="mt-1 text-sm font-bold tabular-nums text-emerald-400">
              {formatFileSize(lastResult.outputBytes)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Saved</p>
            <p className="mt-1 text-sm font-bold tabular-nums text-emerald-300">
              {formatFileSize(savings.saved)} ({savings.pct}%)
            </p>
          </div>
        </div>
      )}

      <ActionButton onClick={compress} disabled={busy || !file}>
        {busy ? 'Compressing…' : 'Compress & Download'}
      </ActionButton>
      <StatusMessage error={error} success={success} />
    </div>
  );
}
