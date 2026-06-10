import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionButton, FileDropZone, StatusMessage } from './ToolWorkspaceShell';
import { useToolProgress } from './ToolProgressContext';
import { usePdfDocument } from '../../hooks/usePdfDocument';
import { defaultCropRect, normalizedCropToPdfBox, type NormalizedCropRect } from '../../lib/cropCoords';
import { downloadBytes, releaseCanvas, renderPdfPageOnCanvas } from '../../lib/pdfEngine';
import { runPdfWorkerWithStreamedFile } from '../../lib/pdfWorkerClient';

type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se';

export default function CropPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [crop, setCrop] = useState<NormalizedCropRect>(defaultCropRect());
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    handle: Handle;
    startX: number;
    startY: number;
    start: NormalizedCropRect;
  } | null>(null);

  const { pdf, loading, error: pdfError, numPages } = usePdfDocument(file);
  const { report, resetProgress } = useToolProgress();

  useEffect(() => {
    setCrop(defaultCropRect());
  }, [pageIndex, file]);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;

    let cancelled = false;
    const canvas = canvasRef.current;

    (async () => {
      try {
        await renderPdfPageOnCanvas(pdf, pageIndex + 1, canvas, 1.1);
        const page = await pdf.getPage(pageIndex + 1);
        const vp = page.getViewport({ scale: 1 });
        if (!cancelled) setPageSize({ width: vp.width, height: vp.height });
        page.cleanup();
      } catch {
        if (!cancelled) setPageSize(null);
      }
    })();

    return () => {
      cancelled = true;
      releaseCanvas(canvas);
    };
  }, [pdf, pageIndex]);

  const startDrag = (handle: Handle, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { handle, startX: e.clientX, startY: e.clientY, start: { ...crop } };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    const box = overlayRef.current;
    if (!drag || !box) return;

    const rect = box.getBoundingClientRect();
    const dx = (e.clientX - drag.startX) / rect.width;
    const dy = (e.clientY - drag.startY) / rect.height;
    const s = drag.start;

    if (drag.handle === 'move') {
      setCrop({
        ...s,
        x: Math.min(1 - s.w, Math.max(0, s.x + dx)),
        y: Math.min(1 - s.h, Math.max(0, s.y + dy)),
      });
      return;
    }

    let { x, y, w, h } = s;
    if (drag.handle.includes('e')) w = Math.min(1 - x, Math.max(0.05, s.w + dx));
    if (drag.handle.includes('w')) {
      const nw = Math.max(0.05, s.w - dx);
      x = Math.max(0, s.x + s.w - nw);
      w = nw;
    }
    if (drag.handle.includes('s')) h = Math.min(1 - y, Math.max(0.05, s.h + dy));
    if (drag.handle.includes('n')) {
      const nh = Math.max(0.05, s.h - dy);
      y = Math.max(0, s.y + s.h - nh);
      h = nh;
    }
    setCrop({ x, y, w, h });
  };

  const applyCrop = useCallback(async () => {
    if (!file || !pageSize) {
      setError('Select a PDF and define a crop area.');
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const pdfCrop = normalizedCropToPdfBox(crop, pageSize.width, pageSize.height);
      const out = await runPdfWorkerWithStreamedFile<Uint8Array>(
        'crop-pdf',
        file,
        { pageIndex, crop: pdfCrop },
        ({ current, total, label }) => report(current, total, label)
      );
      downloadBytes(out, file.name, 'application/pdf', '_cropped');
      setSuccess('Crop applied to the selected page.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Crop failed.');
    } finally {
      resetProgress();
      setBusy(false);
    }
  }, [file, pageSize, crop, pageIndex, report, resetProgress]);

  const handleCls = 'absolute h-3 w-3 rounded-sm bg-emerald-400 ring-1 ring-emerald-900';

  return (
    <div className="space-y-4">
      <FileDropZone accept="application/pdf" label="Select PDF to crop" onFiles={(f) => setFile(f[0] ?? null)} />

      {numPages > 1 && (
        <label className="block">
          <span className="label text-emerald-200">Crop page</span>
          <select
            className="input-field"
            value={pageIndex}
            onChange={(e) => setPageIndex(Number(e.target.value))}
          >
            {Array.from({ length: numPages }, (_, i) => (
              <option key={i} value={i}>
                Page {i + 1}
              </option>
            ))}
          </select>
        </label>
      )}

      {loading && <p className="text-center text-sm text-emerald-200">Loading page…</p>}

      {pdf && (
        <div ref={overlayRef} className="relative mx-auto max-w-lg overflow-hidden rounded-xl border border-emerald-800/50 bg-white">
          <canvas ref={canvasRef} className="block w-full" aria-hidden="true" />
          <div
            className="absolute border-2 border-emerald-400 bg-emerald-400/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
            style={{
              left: `${crop.x * 100}%`,
              top: `${crop.y * 100}%`,
              width: `${crop.w * 100}%`,
              height: `${crop.h * 100}%`,
            }}
            onPointerDown={(e) => startDrag('move', e)}
            onPointerMove={onPointerMove}
            onPointerUp={() => { dragRef.current = null; }}
          >
            <span className={`${handleCls} -left-1.5 -top-1.5 cursor-nw-resize`} onPointerDown={(e) => startDrag('nw', e)} />
            <span className={`${handleCls} -right-1.5 -top-1.5 cursor-ne-resize`} onPointerDown={(e) => startDrag('ne', e)} />
            <span className={`${handleCls} -bottom-1.5 -left-1.5 cursor-sw-resize`} onPointerDown={(e) => startDrag('sw', e)} />
            <span className={`${handleCls} -bottom-1.5 -right-1.5 cursor-se-resize`} onPointerDown={(e) => startDrag('se', e)} />
          </div>
        </div>
      )}

      <p className="text-center text-xs text-slate-500">Drag the box or corner handles to crop photos & signatures</p>

      <ActionButton onClick={applyCrop} disabled={busy || !file}>
        {busy ? 'Cropping…' : 'Apply Crop & Download'}
      </ActionButton>
      <StatusMessage error={pdfError ?? error} success={success} />
    </div>
  );
}
