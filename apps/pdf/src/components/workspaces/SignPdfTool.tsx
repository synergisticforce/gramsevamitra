import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionButton, FileDropZone, StatusMessage } from './ToolWorkspaceShell';
import { useToolProgress } from './ToolProgressContext';
import SignaturePad from '../shared/SignaturePad';
import { usePdfDocument } from '../../hooks/usePdfDocument';
import { downloadBytes, releaseCanvas, renderPdfPageOnCanvas } from '../../lib/pdfEngine';
import { runPdfWorker } from '../../lib/pdfWorkerClient';

interface Placement {
  x: number;
  y: number;
  w: number;
  h: number;
}

const DEFAULT_PLACEMENT: Placement = { x: 0.55, y: 0.78, w: 0.32, h: 0.12 };

export default function SignPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [showPad, setShowPad] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [placement, setPlacement] = useState<Placement>(DEFAULT_PLACEMENT);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ mode: 'move' | 'resize'; startX: number; startY: number; start: Placement } | null>(null);

  const { pdf, loading, error: pdfError, numPages } = usePdfDocument(file);
  const { report, resetProgress } = useToolProgress();

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

  const handleSignatureChange = useCallback((dataUrl: string | null) => {
    setSignatureUrl(dataUrl);
  }, []);

  const onPointerDown = (mode: 'move' | 'resize', e: React.PointerEvent) => {
    if (!signatureUrl) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, start: { ...placement } };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    const box = previewRef.current;
    if (!drag || !box) return;

    const rect = box.getBoundingClientRect();
    const dx = (e.clientX - drag.startX) / rect.width;
    const dy = (e.clientY - drag.startY) / rect.height;

    if (drag.mode === 'move') {
      setPlacement({
        ...drag.start,
        x: Math.min(1 - drag.start.w, Math.max(0, drag.start.x + dx)),
        y: Math.min(1 - drag.start.h, Math.max(0, drag.start.y + dy)),
      });
    } else {
      setPlacement({
        ...drag.start,
        w: Math.min(1 - drag.start.x, Math.max(0.08, drag.start.w + dx)),
        h: Math.min(1 - drag.start.y, Math.max(0.04, drag.start.h + dy)),
      });
    }
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const applySign = useCallback(async () => {
    if (!file || !signatureUrl || !pageSize) {
      setError('Draw a signature and position it on the page first.');
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(signatureUrl);
      const pngBytes = new Uint8Array(await res.arrayBuffer());
      const pdfX = placement.x * pageSize.width;
      const pdfY = pageSize.height - (placement.y + placement.h) * pageSize.height;
      const pdfW = placement.w * pageSize.width;
      const pdfH = placement.h * pageSize.height;

      const buffer = await file.arrayBuffer();
      const out = await runPdfWorker<Uint8Array>(
        'sign-pdf',
        {
          buffer,
          pageIndex,
          pngBytes: pngBytes.buffer.slice(
            pngBytes.byteOffset,
            pngBytes.byteOffset + pngBytes.byteLength
          ),
          placement: { x: pdfX, y: pdfY, width: pdfW, height: pdfH },
        },
        ({ current, total, label }) => report(current, total, label)
      );
      downloadBytes(out, file.name, 'application/pdf', '_signed');
      setSuccess('Signature applied and flattened into the PDF.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signing failed.');
    } finally {
      resetProgress();
      setBusy(false);
    }
  }, [file, signatureUrl, pageSize, placement, pageIndex, report, resetProgress]);

  return (
    <div className="space-y-4">
      <FileDropZone accept="application/pdf" label="Select PDF to sign" onFiles={(f) => setFile(f[0] ?? null)} />

      {numPages > 1 && (
        <label className="block">
          <span className="label text-emerald-200">Sign on page</span>
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

      <button
        type="button"
        className="rounded-xl border border-emerald-700 bg-[#064e3b]/40 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-[#064e3b]/60"
        onClick={() => setShowPad((v) => !v)}
      >
        {showPad ? 'Hide Signature Pad' : 'Add Signature'}
      </button>

      {showPad && <SignaturePad onSignatureChange={handleSignatureChange} />}

      {loading && <p className="text-center text-sm text-emerald-200">Loading document…</p>}

      {pdf && (
        <div
          ref={previewRef}
          className="relative mx-auto max-w-lg overflow-hidden rounded-xl border border-emerald-800/50 bg-white"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <canvas ref={canvasRef} className="block w-full" aria-hidden="true" />
          {signatureUrl && (
            <div
              className="absolute touch-none border-2 border-dashed border-emerald-500 bg-emerald-500/10"
              style={{
                left: `${placement.x * 100}%`,
                top: `${placement.y * 100}%`,
                width: `${placement.w * 100}%`,
                height: `${placement.h * 100}%`,
              }}
              onPointerDown={(e) => onPointerDown('move', e)}
            >
              <img src={signatureUrl} alt="Signature placement" className="h-full w-full object-contain" draggable={false} />
              <div
                className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize bg-emerald-500"
                onPointerDown={(e) => onPointerDown('resize', e)}
              />
            </div>
          )}
        </div>
      )}

      <ActionButton onClick={applySign} disabled={busy || !file || !signatureUrl}>
        {busy ? 'Signing…' : 'Apply Signature & Download'}
      </ActionButton>
      <StatusMessage error={pdfError ?? error} success={success} />
    </div>
  );
}
