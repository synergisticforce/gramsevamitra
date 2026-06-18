import { useCallback, useEffect, useRef, useState } from 'react';
import {
  renderTypedSignaturePng,
  signPdfInBrowser,
  triggerPdfDownload,
} from '../../lib/canvas/documentPdfTools';
import { requiresChunkedPipeline } from '../../lib/pdf/fileUploadLimits';
import { runChunkedSignPipeline } from '../../lib/upload/chunkedPipeline';
import { canvasToPngBlob } from '../../lib/pdf/pdfRender';

type SignMode = 'draw' | 'type';

interface Props {
  file: File;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

function canvasHasInk(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const data = ctx.getImageData(0, 0, w, h).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) return true;
  }
  return false;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export default function SignPdfModal({ file, onClose, onSuccess, onProcessingChange }: Props) {
  const [mode, setMode] = useState<SignMode>('draw');
  const [typedName, setTypedName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || mode !== 'draw') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const pointFromEvent = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
      };
    };

    const onDown = (event: PointerEvent) => {
      drawingRef.current = true;
      const { x, y } = pointFromEvent(event);
      ctx.beginPath();
      ctx.moveTo(x, y);
      canvas.setPointerCapture(event.pointerId);
    };

    const onMove = (event: PointerEvent) => {
      if (!drawingRef.current) return;
      const { x, y } = pointFromEvent(event);
      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const onUp = (event: PointerEvent) => {
      drawingRef.current = false;
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', onUp);

    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointerleave', onUp);
    };
  }, [mode]);

  const clearPad = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const resolveSignatureBytes = useCallback(async (): Promise<Uint8Array> => {
    if (mode === 'type') {
      return renderTypedSignaturePng(typedName);
    }
    const canvas = canvasRef.current;
    if (!canvas) throw new Error('Signature pad not ready.');
    const ctx = canvas.getContext('2d');
    if (!ctx || !canvasHasInk(ctx, canvas.width, canvas.height)) {
      throw new Error('Draw your signature on the pad first.');
    }
    const blob = await canvasToPngBlob(canvas);
    return new Uint8Array(await blob.arrayBuffer());
  }, [mode, typedName]);

  const handleSign = useCallback(async () => {
    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Stamping signature…', 0);

    try {
      const signatureBytes = await resolveSignatureBytes();

      if (requiresChunkedPipeline(file)) {
        const signatureBase64 = bytesToBase64(signatureBytes);
        await runChunkedSignPipeline(file, signatureBase64, undefined, ({ label, percent }) =>
          onProcessingChange(true, label, percent),
        );
        onProcessingChange(false, '', 0);
        onSuccess('PDF signed via Smart Slicing — download started.');
        onClose();
        return;
      }

      const { bytes, downloadName } = await signPdfInBrowser(
        file,
        { signatureBytes },
        ({ current, total, label }) => {
          const percent = total > 0 ? Math.round((current / total) * 100) : 0;
          onProcessingChange(true, label, percent);
        },
      );
      triggerPdfDownload(bytes, downloadName, '_signed');
      onProcessingChange(false, '', 0);
      onSuccess('Signature stamped on all pages — download started.');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signing failed.');
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [file, onClose, onProcessingChange, onSuccess, resolveSignatureBytes]);

  const pillClass = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
      active
        ? 'border-canvas-accent bg-canvas-accent-soft text-canvas-accent'
        : 'border-canvas-border text-slate-200 hover:border-emerald-300'
    }`;

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sign-pdf-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="sign-pdf-title" className="text-lg font-bold text-canvas-text">
              Sign PDF (Self-Attestation)
            </h2>
            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-300 truncate">{file.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg px-2 py-1 text-canvas-subtle transition hover:bg-canvas-elevated hover:text-canvas-muted disabled:opacity-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className="mt-4 text-sm font-medium leading-relaxed text-slate-200">
          Draw or type your signature. It will be placed on the bottom-left of every page.
        </p>

        <div className="mt-3 flex gap-2">
          <button type="button" className={pillClass(mode === 'draw')} onClick={() => setMode('draw')}>
            Draw
          </button>
          <button type="button" className={pillClass(mode === 'type')} onClick={() => setMode('type')}>
            Type
          </button>
        </div>

        {mode === 'draw' ? (
          <div className="mt-3">
            <canvas
              ref={canvasRef}
              width={560}
              height={180}
              className="h-36 w-full touch-none rounded-xl border border-canvas-border bg-white"
              aria-label="Signature drawing pad"
            />
            <button
              type="button"
              onClick={clearPad}
              disabled={busy}
              className="mt-2 text-xs font-semibold text-slate-200 underline hover:text-white"
            >
              Clear pad
            </button>
          </div>
        ) : (
          <label className="mt-3 block">
            <span className="text-xs font-semibold text-slate-200">Your name</span>
            <input
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              disabled={busy}
              placeholder="e.g. Rajesh Kumar"
              className="mt-1 w-full rounded-xl border border-canvas-border bg-canvas-elevated px-3 py-2.5 text-sm text-canvas-text placeholder:text-slate-400"
            />
          </label>
        )}

        {error && (
          <p className="mt-3 rounded-lg border border-canvas-border bg-canvas-danger-soft/30 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-canvas-border px-4 py-2.5 text-sm font-semibold text-canvas-muted transition hover:bg-canvas-elevated disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSign()}
            disabled={busy}
            className="rounded-xl bg-canvas-accent-muted px-4 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Signing…' : 'Sign & download'}
          </button>
        </div>
      </div>
    </div>
  );
}
