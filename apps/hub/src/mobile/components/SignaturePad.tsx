import { useCallback, useEffect, useRef, useState } from 'react';

export interface SignaturePadProps {
  onSave: (signatureBlob: Blob) => void;
  onCancel: () => void;
}

interface Point {
  x: number;
  y: number;
}

function getCanvasPoint(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): Point {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

export default function SignaturePad({ onSave, onCancel }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const ratio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const width = canvas.clientWidth || 320;
    const height = canvas.clientHeight || 180;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setHasInk(false);
  }, []);

  useEffect(() => {
    setupCanvas();
    const onResize = () => setupCanvas();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setupCanvas]);

  const beginStroke = (point: Point) => {
    drawingRef.current = true;
    lastPointRef.current = point;
  };

  const drawStroke = (point: Point) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const last = lastPointRef.current;
    if (!canvas || !ctx || !last) return;

    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
    setHasInk(true);
  };

  const endStroke = () => {
    drawingRef.current = false;
    lastPointRef.current = null;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);
    beginStroke(getCanvasPoint(canvas, event.clientX, event.clientY));
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawStroke(getCanvasPoint(canvas, event.clientX, event.clientY));
  };

  const handleClear = () => {
    setError(null);
    setupCanvas();
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) {
      setError('Please sign before saving.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((result) => resolve(result), 'image/png');
      });
      if (!blob) {
        throw new Error('Unable to export signature.');
      }
      onSave(blob);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save signature.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-lg rounded-2xl border border-canvas-border bg-canvas-surface p-4 shadow-none">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-canvas-text">E-Signature</h2>
          <p className="mt-1 text-xs font-medium leading-relaxed text-slate-300">
            Sign with your finger or stylus — saved as a transparent-ready PNG overlay.
          </p>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="mt-4 h-44 w-full touch-none rounded-xl border border-canvas-border bg-white"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onPointerLeave={endStroke}
        aria-label="Signature drawing pad"
      />

      {error && (
        <p
          className="mt-3 rounded-lg border border-canvas-border bg-canvas-danger-soft/30 px-3 py-2 text-sm text-rose-200"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={handleClear}
          disabled={saving}
          className="rounded-xl border border-canvas-border px-3 py-2.5 text-xs font-semibold text-canvas-muted transition hover:bg-canvas-elevated disabled:opacity-50"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-xl border border-canvas-border px-3 py-2.5 text-xs font-semibold text-canvas-muted transition hover:bg-canvas-elevated disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !hasInk}
          className="rounded-xl bg-canvas-accent-muted px-3 py-2.5 text-xs font-semibold text-canvas-text transition hover:bg-canvas-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
