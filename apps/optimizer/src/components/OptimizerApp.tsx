import { useCallback, useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import ImageCompareSlider from './shared/ImageCompareSlider';
import { downloadBlob, getBrandedFilename } from '../lib/fileUtils';
import {
  EXAM_PRESETS,
  formatFileSize,
  processImageDocument,
  processImageToPixelTarget,
  processPdfDocument,
  type DocumentType,
  type ProcessResult,
} from '@shared/utils/documentProcessor';

interface ResultItem extends ProcessResult {
  id: string;
  sourceFileName: string;
  sourceFile: File;
  isImage: boolean;
  sourceBytes: number;
}

type ResizeMode = 'preset' | 'custom';

export default function OptimizerApp() {
  const [resizeMode, setResizeMode] = useState<ResizeMode>('custom');
  const [presetId, setPresetId] = useState(EXAM_PRESETS[0].id);
  const [docType, setDocType] = useState<DocumentType>('photo');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageAspect, setImageAspect] = useState<number | null>(null);
  const [widthPx, setWidthPx] = useState(350);
  const [heightPx, setHeightPx] = useState(450);
  const [lockAspect, setLockAspect] = useState(true);
  const [targetKb, setTargetKb] = useState(50);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preset = useMemo(
    () => EXAM_PRESETS.find((p) => p.id === presetId) ?? EXAM_PRESETS[0],
    [presetId]
  );

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      setImageAspect(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    if (file.type.startsWith('image/')) {
      const img = new Image();
      img.onload = () => {
        const aspect = img.width / img.height;
        setImageAspect(aspect);
        setWidthPx(Math.min(1200, Math.max(32, img.width)));
        setHeightPx(Math.min(1200, Math.max(32, Math.round(img.width / aspect))));
      };
      img.src = url;
    }

    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setResults([]);
  }, []);

  const updateWidth = useCallback(
    (nextWidth: number) => {
      const w = Math.max(32, Math.min(4096, nextWidth));
      setWidthPx(w);
      if (lockAspect && imageAspect) {
        setHeightPx(Math.max(32, Math.round(w / imageAspect)));
      }
    },
    [lockAspect, imageAspect]
  );

  const updateHeight = useCallback(
    (nextHeight: number) => {
      const h = Math.max(32, Math.min(4096, nextHeight));
      setHeightPx(h);
      if (lockAspect && imageAspect) {
        setWidthPx(Math.max(32, Math.round(h * imageAspect)));
      }
    },
    [lockAspect, imageAspect]
  );

  const handleProcess = useCallback(async () => {
    if (!file) {
      setError('Please select a file to optimize.');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      let result: ProcessResult;
      const isImage = docType !== 'pdf';

      if (docType === 'pdf') {
        if (!preset.pdfMaxKb) {
          throw new Error('PDF optimization is only available for UPSC preset.');
        }
        result = await processPdfDocument(file, preset.pdfMaxKb);
      } else if (resizeMode === 'custom') {
        result = await processImageToPixelTarget(
          file,
          widthPx,
          heightPx,
          targetKb,
          docType === 'photo' ? 'photo' : 'signature'
        );
      } else {
        const spec = docType === 'photo' ? preset.photo : preset.signature;
        if (!spec) {
          throw new Error(`This exam preset does not support ${docType} documents.`);
        }
        result = await processImageDocument(file, spec, preset.dpi, docType);
      }

      setResults((prev) => [
        ...prev,
        {
          ...result,
          id: `${Date.now()}-${result.fileName}`,
          sourceFileName: file.name,
          sourceFile: file,
          isImage,
          sourceBytes: file.size,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  }, [file, docType, preset, resizeMode, widthPx, heightPx, targetKb]);

  const downloadAll = useCallback(async () => {
    if (results.length === 0) return;
    if (results.length === 1) {
      downloadBlob(results[0].blob, results[0].sourceFileName, '_compressed');
      return;
    }
    const zip = new JSZip();
    results.forEach((r) => {
      zip.file(getBrandedFilename(r.sourceFileName, '_compressed'), r.blob);
    });
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(zipBlob, `optimized-${preset.id}.zip`, '_export');
  }, [results, preset.id]);

  const specLabel = useMemo(() => {
    if (resizeMode === 'custom' && docType !== 'pdf') {
      return `${widthPx}×${heightPx}px · target ≤ ${targetKb} KB`;
    }
    if (docType === 'pdf') {
      return preset.pdfMaxKb ? `PDF max ${preset.pdfMaxKb} KB` : 'N/A';
    }
    const spec = docType === 'photo' ? preset.photo : preset.signature;
    if (!spec) return 'N/A';
    return `${spec.widthCm}×${spec.heightCm} cm · ${spec.minKb}–${spec.maxKb} KB`;
  }, [resizeMode, docType, preset, widthPx, heightPx, targetKb]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100">
        100% free — unlimited optimizations and ZIP downloads. Resize on canvas, then compress to your exact KB target — all locally in your browser.
      </div>

      <div className="card space-y-5">
        <div>
          <span className="label">Resize mode</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                resizeMode === 'custom'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              onClick={() => setResizeMode('custom')}
            >
              Custom pixels (ResizePixel-style)
            </button>
            <button
              type="button"
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                resizeMode === 'preset'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              onClick={() => setResizeMode('preset')}
            >
              Exam preset
            </button>
          </div>
        </div>

        {resizeMode === 'preset' && (
          <div>
            <label htmlFor="exam-preset" className="label">
              Exam Preset
            </label>
            <select
              id="exam-preset"
              className="input-field"
              value={presetId}
              onChange={(e) => {
                setPresetId(e.target.value);
                setResults([]);
                setError(null);
                if (e.target.value !== 'upsc-cse' && docType === 'pdf') {
                  setDocType('photo');
                }
              }}
            >
              {EXAM_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} — {p.description}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <span className="label">Document Type</span>
          <div className="flex flex-wrap gap-2">
            {(['photo', 'signature'] as const).map((type) => (
              <button
                key={type}
                type="button"
                className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
                  docType === type
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                onClick={() => {
                  setDocType(type);
                  setResults([]);
                  setError(null);
                }}
              >
                {type}
              </button>
            ))}
            {resizeMode === 'preset' && preset.pdfMaxKb && (
              <button
                type="button"
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  docType === 'pdf'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                onClick={() => {
                  setDocType('pdf');
                  setResults([]);
                  setError(null);
                }}
              >
                PDF
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">Target: {specLabel}</p>
        </div>

        {resizeMode === 'custom' && docType !== 'pdf' && (
          <div className="space-y-4 rounded-xl border border-slate-700 bg-slate-900/50 p-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-400">Width (px)</span>
                <input
                  type="number"
                  min={32}
                  max={4096}
                  value={widthPx}
                  onChange={(e) => updateWidth(Number(e.target.value) || 32)}
                  className="input-field w-full tabular-nums"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-400">Height (px)</span>
                <input
                  type="number"
                  min={32}
                  max={4096}
                  value={heightPx}
                  onChange={(e) => updateHeight(Number(e.target.value) || 32)}
                  className="input-field w-full tabular-nums"
                />
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={lockAspect}
                onChange={(e) => setLockAspect(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 accent-emerald-500"
              />
              Lock aspect ratio
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">Target file size (KB)</span>
              <input
                type="number"
                min={1}
                max={5120}
                value={targetKb}
                onChange={(e) => setTargetKb(Math.max(1, Number(e.target.value) || 1))}
                className="input-field w-full tabular-nums"
              />
            </label>
          </div>
        )}

        <div>
          <label htmlFor="file-upload" className="label">
            Upload {docType === 'pdf' ? 'PDF' : 'Image (JPG/PNG)'}
          </label>
          <input
            id="file-upload"
            type="file"
            accept={docType === 'pdf' ? 'application/pdf' : 'image/jpeg,image/png,image/jpg'}
            className="input-field file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-emerald-500"
            onChange={handleFileChange}
            disabled={processing}
          />
        </div>

        {previewUrl && docType !== 'pdf' && results.length === 0 && (
          <div className="flex justify-center">
            <img
              src={previewUrl}
              alt="Upload preview"
              className="max-h-48 rounded-lg border border-slate-700 object-contain"
            />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-800/50 bg-red-950/40 px-4 py-3 text-sm text-red-200" role="alert">
            {error}
          </div>
        )}

        <button
          type="button"
          className="btn-primary w-full"
          onClick={handleProcess}
          disabled={processing || !file}
        >
          {processing ? 'Processing…' : 'Optimize Document'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="card animate-fade-in space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Results</h2>
            <button type="button" className="btn-secondary text-xs" onClick={downloadAll}>
              Download {results.length > 1 ? 'All (ZIP)' : 'File'}
            </button>
          </div>

          <ul className="space-y-3">
            {results.map((r) => {
              const savedBytes = Math.max(0, r.sourceBytes - r.sizeBytes);
              const savedPct = r.sourceBytes > 0 ? Math.round((savedBytes / r.sourceBytes) * 100) : 0;
              return (
                <li
                  key={r.id}
                  className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-900/80 p-4"
                >
                  {r.isImage && (
                    <ImageCompareSlider
                      original={r.sourceFile}
                      compressed={r.blob}
                      originalLabel="Original"
                      compressedLabel="Optimized"
                    />
                  )}

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-slate-200">
                        {getBrandedFilename(r.sourceFileName, '_compressed')}
                      </p>
                      <p className="text-xs text-slate-500">
                        {r.width > 0 && `${r.width}×${r.height}px · `}
                        {formatFileSize(r.sizeBytes)}
                        {r.quality < 1 && ` · quality ${Math.round(r.quality * 100)}%`}
                      </p>
                      <p className="mt-1 text-xs font-medium text-emerald-400">
                        {formatFileSize(r.sourceBytes)} → {formatFileSize(r.sizeBytes)}
                        {savedBytes > 0 && ` · saved ${formatFileSize(savedBytes)} (${savedPct}%)`}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-primary shrink-0 text-xs"
                      onClick={() => downloadBlob(r.blob, r.sourceFileName, '_compressed')}
                    >
                      Download
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
