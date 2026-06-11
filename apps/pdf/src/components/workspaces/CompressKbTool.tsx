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

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function sliderToParams(qualitySlider: number): { quality: number; scale: number; label: string } {
  const t = Math.min(100, Math.max(0, qualitySlider)) / 100;
  const quality = 0.35 + t * 0.57;
  const scale = 0.85 + t * 0.55;
  let label = 'Balanced compression';
  if (t <= 0.25) label = 'Maximum compression (smaller file)';
  else if (t >= 0.75) label = 'High quality (larger file)';
  return { quality, scale, label };
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
  const [qualitySlider, setQualitySlider] = useState(55);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { report, resetProgress, setProgress } = useToolProgress();

  const params = useMemo(() => sliderToParams(qualitySlider), [qualitySlider]);
  const heavyDocument = file ? isHeavyDocument(file.size) : false;

  const compress = useCallback(async () => {
    if (!file) {
      setError('Please select a PDF first.');
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    setProgress({ active: true, percent: 0, label: 'Analyzing PDF…' });

    try {
      const { quality, scale, label } = sliderToParams(qualitySlider);
      const out = await compressWithJpegPreset(file, quality, scale, report);
      const finalKb = Math.round(out.length / 1024);
      downloadBytes(out, file.name, 'application/pdf', '_compressed');
      setSuccess(`Done! Output size: ${finalKb} KB (${label}, quality ${qualitySlider}).`);
    } catch (err) {
      setError(toProcessingError(err));
    } finally {
      resetProgress();
      setBusy(false);
    }
  }, [file, qualitySlider, report, resetProgress, setProgress]);

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
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="compress-quality" className="text-sm font-semibold text-white">
            Compression quality
          </label>
          <span className="text-sm tabular-nums text-emerald-400">{qualitySlider}</span>
        </div>
        <input
          id="compress-quality"
          type="range"
          min={0}
          max={100}
          value={qualitySlider}
          onChange={(e) => setQualitySlider(Number(e.target.value))}
          className="mt-3 w-full accent-[#10b981]"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={qualitySlider}
        />
        <p className="mt-2 text-xs text-slate-400">
          {params.label} — lower values shrink file size more; higher values preserve text sharpness.
        </p>
      </div>

      <ActionButton onClick={compress} disabled={busy || !file}>
        {busy ? 'Compressing…' : 'Compress & Download'}
      </ActionButton>
      <StatusMessage error={error} success={success} />
    </div>
  );
}
