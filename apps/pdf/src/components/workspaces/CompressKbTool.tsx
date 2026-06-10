import { useCallback, useState } from 'react';
import { ActionButton, FileDropZone, StatusMessage } from './ToolWorkspaceShell';
import { useToolProgress } from './ToolProgressContext';
import {
  canvasToJpegBlob,
  downloadBytes,
  loadPdfDocument,
  renderPdfPageToCanvas,
} from '../../lib/pdfEngine';
import { EXTREME_FALLBACK_MESSAGE, isPdfStructuralError } from '../../lib/compressionErrors';
import { isHeavyDocument } from '../../lib/pdfMemory';
import {
  runPdfWorkerWithJpegPages,
  runPdfWorkerWithStreamedFile,
} from '../../lib/pdfWorkerClient';

type CompressPreset = 'extreme' | 'recommended' | 'high';

const PRESETS: Record<
  CompressPreset,
  { label: string; hint: string; quality: number; scale: number }
> = {
  extreme: {
    label: 'Extreme Compression (Low Quality)',
    hint: 'Smallest file — bytecode strip + structure rebuild (no canvas re-encode)',
    quality: 0.42,
    scale: 0.85,
  },
  recommended: {
    label: 'Recommended Compression (Good Balance)',
    hint: 'Ideal for most exam portal uploads',
    quality: 0.68,
    scale: 1.1,
  },
  high: {
    label: 'High Quality (Low Compression)',
    hint: 'Keeps text sharp with moderate size reduction',
    quality: 0.88,
    scale: 1.4,
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
  const [preset, setPreset] = useState<CompressPreset>('recommended');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const { report, resetProgress, setProgress } = useToolProgress();

  const heavyDocument = file ? isHeavyDocument(file.size) : false;

  const compress = useCallback(async () => {
    if (!file) {
      setError('Please select a PDF first.');
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    setWarning(null);
    setProgress({ active: true, percent: 0, label: 'Analyzing PDF…' });

    try {
      let out: Uint8Array;
      let usedPreset = preset;

      if (preset === 'extreme') {
        try {
          out = await runPdfWorkerWithStreamedFile<Uint8Array>(
            'compress-extreme',
            file,
            {},
            ({ current, total, label }) => report(current, total, label)
          );
        } catch (extremeErr) {
          if (!isPdfStructuralError(extremeErr)) {
            throw extremeErr;
          }
          setWarning(EXTREME_FALLBACK_MESSAGE);
          usedPreset = 'recommended';
          const { quality, scale } = PRESETS.recommended;
          out = await compressWithJpegPreset(file, quality, scale, report);
        }
      } else {
        const { quality, scale } = PRESETS[preset];
        out = await compressWithJpegPreset(file, quality, scale, report);
      }

      const finalKb = Math.round(out.length / 1024);
      downloadBytes(out, file.name, 'application/pdf', '_compressed');
      setSuccess(`Done! Output size: ${finalKb} KB (${PRESETS[usedPreset].label}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Compression failed.');
    } finally {
      resetProgress();
      setBusy(false);
    }
  }, [file, preset, report, resetProgress, setProgress]);

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

      <div className="space-y-3">
        {(Object.keys(PRESETS) as CompressPreset[]).map((key) => {
          const cfg = PRESETS[key];
          const active = preset === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setPreset(key)}
              className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                active
                  ? 'border-[#10b981] bg-[#064e3b]/60 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.4)]'
                  : 'border-emerald-900/50 bg-slate-950/60 hover:border-emerald-700'
              }`}
            >
              <p className={`text-sm font-bold ${active ? 'text-[#10b981]' : 'text-white'}`}>
                {cfg.label}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">{cfg.hint}</p>
              <input
                type="range"
                min={0}
                max={100}
                value={active ? 100 : 40}
                readOnly
                tabIndex={-1}
                className="mt-2 w-full accent-[#10b981] pointer-events-none"
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>

      <ActionButton onClick={compress} disabled={busy || !file}>
        {busy ? 'Compressing…' : 'Compress & Download'}
      </ActionButton>
      <StatusMessage warning={warning} error={error} success={success} />
    </div>
  );
}
