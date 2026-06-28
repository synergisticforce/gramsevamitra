import { useCallback, useEffect, useRef, useState } from 'react';

interface RedactionRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

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
      reject(new Error('Could not load image.'));
    };
    img.src = url;
  });
}

async function renderPdfFirstPage(file: File, maxWidth: number): Promise<HTMLCanvasElement> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const workerUrl = (await import('pdfjs-dist/legacy/build/pdf.worker.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  if (pdf.numPages < 1) throw new Error('PDF has no pages.');

  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const scale = maxWidth / viewport.width;
  const scaled = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(scaled.width);
  canvas.height = Math.floor(scaled.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  await page.render({ canvasContext: ctx, viewport: scaled }).promise;
  return canvas;
}

export default function DocumentRedactor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [sourceCanvas, setSourceCanvas] = useState<HTMLCanvasElement | null>(null);
  const [redactions, setRedactions] = useState<RedactionRect[]>([]);
  const [drawing, setDrawing] = useState<{ startX: number; startY: number; current: RedactionRect | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('redacted');

  const getCanvasCoords = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * canvas.width;
      const y = ((clientY - rect.top) / rect.height) * canvas.height;
      return { x, y };
    },
    [],
  );

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sourceCanvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = sourceCanvas.width;
    canvas.height = sourceCanvas.height;
    ctx.drawImage(sourceCanvas, 0, 0);

    ctx.fillStyle = '#000000';
    for (const r of redactions) {
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }

    if (drawing?.current) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(drawing.current.x, drawing.current.y, drawing.current.w, drawing.current.h);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2;
      ctx.strokeRect(drawing.current.x, drawing.current.y, drawing.current.w, drawing.current.h);
    }
  }, [sourceCanvas, redactions, drawing]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setRedactions([]);

    try {
      let canvas: HTMLCanvasElement;
      if (file.type === 'application/pdf') {
        canvas = await renderPdfFirstPage(file, 1200);
      } else if (file.type.startsWith('image/')) {
        const img = await loadImageFromFile(file);
        const maxW = 1200;
        let w = img.width;
        let h = img.height;
        if (w > maxW) {
          h = Math.round((h * maxW) / w);
          w = maxW;
        }
        canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas unavailable');
        ctx.drawImage(img, 0, 0, w, h);
      } else {
        throw new Error('Upload a JPG, PNG, or single-page PDF.');
      }

      setSourceCanvas(canvas);
      setFileName(file.name.replace(/\.[^.]+$/, '') || 'redacted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file.');
    }
  }, []);

  const pointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!sourceCanvas) return;
      const pt = getCanvasCoords(e.clientX, e.clientY);
      if (!pt) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setDrawing({
        startX: pt.x,
        startY: pt.y,
        current: { id: '', x: pt.x, y: pt.y, w: 0, h: 0 },
      });
    },
    [sourceCanvas, getCanvasCoords],
  );

  const pointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drawing) return;
      const pt = getCanvasCoords(e.clientX, e.clientY);
      if (!pt) return;
      const x = Math.min(drawing.startX, pt.x);
      const y = Math.min(drawing.startY, pt.y);
      const w = Math.abs(pt.x - drawing.startX);
      const h = Math.abs(pt.y - drawing.startY);
      setDrawing({ ...drawing, current: { id: '', x, y, w, h } });
    },
    [drawing, getCanvasCoords],
  );

  const pointerUp = useCallback(() => {
    if (!drawing?.current || drawing.current.w < 4 || drawing.current.h < 4) {
      setDrawing(null);
      return;
    }
    const rect = { ...drawing.current, id: `${Date.now()}` };
    setRedactions((prev) => [...prev, rect]);
    setDrawing(null);
  }, [drawing]);

  const undo = useCallback(() => {
    setRedactions((prev) => prev.slice(0, -1));
  }, []);

  const clearAll = useCallback(() => {
    setRedactions([]);
  }, []);

  const exportImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}-redacted.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }, [fileName]);

  return (
    <div className="document-redactor space-y-4">
      <section className="rounded-2xl border border-slate-800 bg-canvas-accent-muted/60 p-5 shadow-none sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-subtle">Upload &amp; redact</h2>
        <p className="mt-2 text-xs font-medium leading-relaxed text-slate-300">
          Drag black boxes over sensitive text. Redactions are burned into the exported PNG — nothing is uploaded.
        </p>

        <label className="mt-4 block">
          <span className="mb-2 block text-sm font-medium text-canvas-muted">Image or PDF (first page)</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={handleUpload}
            className="block w-full text-sm font-medium leading-relaxed text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-canvas-accent-muted file:px-4 file:py-2 file:text-sm file:font-semibold file:text-canvas-text hover:file:bg-canvas-accent-soft0"
          />
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={undo} disabled={redactions.length === 0} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40">
            Undo last
          </button>
          <button type="button" onClick={clearAll} disabled={redactions.length === 0} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40">
            Clear all
          </button>
          <button type="button" onClick={exportImage} disabled={!sourceCanvas} className="btn-primary px-3 py-1.5 text-xs disabled:opacity-40">
            Download redacted PNG
          </button>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-300" role="alert">
            {error}
          </p>
        )}

        <div ref={containerRef} className="mt-4 overflow-auto rounded-xl border border-slate-800 bg-slate-950/60 p-2">
          {sourceCanvas ? (
            <canvas
              ref={canvasRef}
              className="mx-auto max-w-full cursor-crosshair touch-none"
              onPointerDown={pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={pointerUp}
              onPointerLeave={pointerUp}
              role="img"
              aria-label="Document canvas — drag to draw redaction boxes"
            />
          ) : (
            <p className="py-16 text-center text-sm font-medium leading-relaxed text-slate-200">Upload a document to begin redacting.</p>
          )}
        </div>

        {redactions.length > 0 && (
          <p className="mt-2 text-center text-xs font-medium leading-relaxed text-slate-300">{redactions.length} redaction box(es) applied</p>
        )}
      </section>
    </div>
  );
}
