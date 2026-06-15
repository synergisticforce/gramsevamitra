import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  EXAM_PRESETS,
  cropImageToCanvas,
  dimensionToPixels,
  formatFileSize,
  processImageCanvas,
  type DocumentType,
  type ProcessResult,
} from '@shared/utils/documentProcessor';

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unable to load image. Use JPG or PNG.'));
    };
    img.src = url;
  });
}

export default function ExamPhotoStudio() {
  const [presetId, setPresetId] = useState(EXAM_PRESETS[0].id);
  const [docType, setDocType] = useState<DocumentType>('photo');
  const [file, setFile] = useState<File | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [panX, setPanX] = useState(0.5);
  const [panY, setPanY] = useState(0.5);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cropPreviewUrl, setCropPreviewUrl] = useState<string | null>(null);
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; startPanX: number; startPanY: number } | null>(null);
  const cropFrameRef = useRef<HTMLDivElement>(null);

  const preset = useMemo(
    () => EXAM_PRESETS.find((p) => p.id === presetId) ?? EXAM_PRESETS[0],
    [presetId],
  );

  const spec = docType === 'photo' ? preset.photo : preset.signature;

  const aspectRatio = useMemo(() => {
    if (!spec) return 3.5 / 4.5;
    return spec.widthCm / spec.heightCm;
  }, [spec]);

  const targetPixels = useMemo(() => {
    if (!spec) return { width: 276, height: 354, maxBytes: 50 * 1024 };
    const px = dimensionToPixels(spec, preset.dpi);
    return { width: px.width, height: px.height, maxBytes: px.maxBytes, minBytes: px.minBytes };
  }, [spec, preset.dpi]);

  const resetCrop = useCallback(() => {
    setPanX(0.5);
    setPanY(0.5);
  }, []);

  useEffect(() => {
    resetCrop();
    setResult(null);
    setPreviewUrl(null);
  }, [file, presetId, docType, resetCrop]);

  useEffect(() => {
    if (!image || !spec) {
      setCropPreviewUrl(null);
      return;
    }
    const previewW = 280;
    const previewH = Math.round(previewW / aspectRatio);
    const full = cropImageToCanvas(image, targetPixels.width, targetPixels.height, panX, panY);
    const preview = document.createElement('canvas');
    preview.width = previewW;
    preview.height = previewH;
    const ctx = preview.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(full, 0, 0, previewW, previewH);
    const url = preview.toDataURL('image/jpeg', 0.92);
    setCropPreviewUrl(url);
  }, [image, spec, aspectRatio, targetPixels.width, targetPixels.height, panX, panY]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setError(null);
    setResult(null);
    setPreviewUrl(null);
    try {
      const img = await loadImageFromFile(picked);
      setFile(picked);
      setImage(img);
      resetCrop();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load image.');
      setFile(null);
      setImage(null);
    }
  }, [resetCrop]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!image) return;
      dragRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        startPanX: panX,
        startPanY: panY,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [image, panX, panY],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      const frame = cropFrameRef.current;
      if (!drag?.active || !frame || !image) return;

      const rect = frame.getBoundingClientRect();
      const sourceRatio = image.width / image.height;
      const targetRatio = aspectRatio;

      let panRangeX = 0;
      let panRangeY = 0;
      if (sourceRatio > targetRatio) panRangeX = 1;
      else panRangeY = 1;

      const dx = (e.clientX - drag.startX) / rect.width;
      const dy = (e.clientY - drag.startY) / rect.height;

      if (panRangeX) {
        setPanX(Math.min(1, Math.max(0, drag.startPanX - dx)));
      }
      if (panRangeY) {
        setPanY(Math.min(1, Math.max(0, drag.startPanY - dy)));
      }
    },
    [image, aspectRatio],
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (dragRef.current) dragRef.current.active = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const handleProcess = useCallback(async () => {
    if (!file || !image || !spec) {
      setError('Upload a photo and choose a valid preset.');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const canvas = cropImageToCanvas(image, targetPixels.width, targetPixels.height, panX, panY);
      const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const processed = await processImageCanvas(
        canvas,
        spec,
        preset.dpi,
        docType === 'signature' ? 'signature' : 'photo',
        file.name.replace(/\.[^.]+$/, ''),
        mimeType,
      );

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(processed.blob));
      setResult(processed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed.');
    } finally {
      setProcessing(false);
    }
  }, [file, image, spec, targetPixels, panX, panY, preset.dpi, docType, previewUrl]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.fileName;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  const maxKb = spec ? spec.maxKb : 50;

  return (
    <div className="exam-photo-studio space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-canvas-accent-muted/60 p-5 shadow-none sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-subtle">Upload &amp; preset</h2>

          <label className="mt-5 block">
            <span className="mb-1 block text-sm font-medium text-canvas-muted">Exam preset</span>
            <select
              value={presetId}
              onChange={(e) => setPresetId(e.target.value)}
              className="select-field w-full py-2.5 text-sm"
            >
              {EXAM_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-canvas-subtle">{preset.description}</p>
          </label>

          <div className="mt-4 flex gap-2">
            {(['photo', 'signature'] as const).map((type) => {
              const enabled = type === 'photo' ? Boolean(preset.photo) : Boolean(preset.signature);
              return (
                <button
                  key={type}
                  type="button"
                  disabled={!enabled}
                  onClick={() => setDocType(type)}
                  className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                    docType === type
                      ? 'border-canvas-accent bg-canvas-accent-soft/50 text-canvas-accent'
                      : 'border-canvas-border bg-slate-950/40 text-canvas-subtle hover:border-canvas-border disabled:opacity-40'
                  }`}
                >
                  {type === 'photo' ? 'Passport photo' : 'Signature'}
                </button>
              );
            })}
          </div>

          {spec && (
            <p className="mt-3 rounded-lg border border-canvas-border bg-canvas-accent-soft/20 px-3 py-2 text-xs text-canvas-muted/90">
              Target: {spec.widthCm}×{spec.heightCm} cm · compress to under{' '}
              <strong>{maxKb} KB</strong> ({targetPixels.width}×{targetPixels.height}px @ {preset.dpi} DPI)
            </p>
          )}

          <label className="mt-5 block">
            <span className="mb-2 block text-sm font-medium text-canvas-muted">Upload image (JPG / PNG)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="block w-full text-sm text-canvas-subtle file:mr-3 file:rounded-lg file:border-0 file:bg-canvas-accent-muted file:px-4 file:py-2 file:text-sm file:font-semibold file:text-canvas-text hover:file:bg-canvas-accent-soft0"
            />
          </label>

          {image && cropPreviewUrl && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-canvas-subtle">Drag inside the frame to reposition crop</p>
              <div
                ref={cropFrameRef}
                className="relative mx-auto w-full max-w-xs touch-none overflow-hidden rounded-xl border-2 border-canvas-accent/60 bg-slate-950"
                style={{ aspectRatio: `${aspectRatio}` }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                role="img"
                aria-label="Crop preview — drag to reposition"
              >
                <img
                  src={cropPreviewUrl}
                  alt="Crop preview"
                  className="h-full w-full object-contain"
                  draggable={false}
                />
                <div className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-emerald-400/30" />
              </div>
              <button type="button" onClick={resetCrop} className="btn-secondary mt-3 w-full text-sm">
                Reset crop position
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleProcess}
            disabled={!image || !spec || processing}
            className="btn-primary mt-5 w-full text-sm disabled:opacity-50"
          >
            {processing ? 'Compressing…' : `Compress to under ${maxKb} KB`}
          </button>

          {error && (
            <p className="mt-3 rounded-lg border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-300" role="alert">
              {error}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-canvas-border bg-gradient-to-br from-emerald-950/50 to-slate-900/60 p-5 shadow-none sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-accent/80">Output</h2>

          {!result ? (
            <div className="mt-8 flex flex-col items-center justify-center text-center text-sm text-canvas-subtle">
              <span className="mb-3 text-4xl" aria-hidden="true">
                📷
              </span>
              <p>Upload a photo, adjust the crop, then compress for exam upload.</p>
              <p className="mt-2 text-xs">All processing happens locally — nothing is uploaded.</p>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-canvas-subtle">File size</span>
                <span
                  className={`font-bold tabular-nums ${
                    result.sizeBytes <= targetPixels.maxBytes ? 'text-canvas-accent' : 'text-amber-400'
                  }`}
                >
                  {formatFileSize(result.sizeBytes)}
                  {result.sizeBytes <= targetPixels.maxBytes ? ' ✓' : ''}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-canvas-subtle">Dimensions</span>
                <span className="font-semibold tabular-nums text-canvas-text">
                  {result.width}×{result.height}px
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-canvas-subtle">Quality</span>
                <span className="font-semibold tabular-nums text-canvas-text">{Math.round(result.quality * 100)}%</span>
              </div>

              {previewUrl && (
                <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60 p-2">
                  <img
                    src={previewUrl}
                    alt="Compressed output preview"
                    className="mx-auto max-h-64 w-auto object-contain"
                  />
                </div>
              )}

              <button type="button" onClick={handleDownload} className="btn-primary w-full text-sm">
                Download {result.fileName}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
