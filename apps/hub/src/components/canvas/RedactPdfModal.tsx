import { useCallback, useEffect, useRef, useState } from 'react';
import { redactPdfInBrowser, triggerPdfDownload } from '../../lib/canvas/documentPdfTools';
import type { PageRedactions, RedactionBox } from '../../lib/pdf/redactionTypes';
import { requiresChunkedPipeline } from '../../lib/pdf/fileUploadLimits';
import { runChunkedRedactPipeline } from '../../lib/upload/chunkedPipeline';
import { useModalMetaLoading } from '../../lib/canvas/useModalMetaLoading';
import ToolProcessingWait from './ToolProcessingWait';

interface Props {
  file: File;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

interface DragState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export default function RedactPdfModal({ file, onClose, onSuccess, onProcessingChange }: Props) {
  const [pageCount, setPageCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [redactions, setRedactions] = useState<PageRedactions[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useModalMetaLoading(loadingMeta, busy, onProcessingChange, 'Loading page preview… Please wait');

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      setLoadingMeta(true);
      setError(null);
      try {
        const { getPdfPageCountFromFile } = await import('../../lib/pdf/pdfWorkerClient');
        const { renderPdfPageToCanvas, canvasToJpegBlob } = await import('../../lib/pdf/pdfRender');
        const count = await getPdfPageCountFromFile(file);
        if (cancelled) return;
        setPageCount(count);
        setPageIndex((prev) => Math.min(prev, Math.max(0, count - 1)));

        const canvas = await renderPdfPageToCanvas(file, pageIndex + 1, 1.1);
        const blob = await canvasToJpegBlob(canvas, 0.85);
        objectUrl = URL.createObjectURL(blob);
        if (cancelled) return;
        setPreviewUrl(objectUrl);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load page preview.');
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file, pageIndex]);

  const boxesForPage = redactions.find((r) => r.pageIndex === pageIndex)?.boxes ?? [];

  const addBox = (box: RedactionBox) => {
    if (box.w < 0.01 || box.h < 0.01) return;
    setRedactions((prev) => {
      const existing = prev.find((r) => r.pageIndex === pageIndex);
      if (existing) {
        return prev.map((r) =>
          r.pageIndex === pageIndex ? { ...r, boxes: [...r.boxes, box] } : r,
        );
      }
      return [...prev, { pageIndex, boxes: [box] }];
    });
  };

  const clearPageBoxes = () => {
    setRedactions((prev) => prev.filter((r) => r.pageIndex !== pageIndex));
  };

  const totalBoxes = redactions.reduce((sum, r) => sum + r.boxes.length, 0);

  const pointerToNormalized = (clientX: number, clientY: number) => {
    const el = overlayRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    return {
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
    };
  };

  const handleApply = useCallback(async () => {
    if (totalBoxes < 1) {
      setError('Draw at least one black redaction box.');
      return;
    }

    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Flattening redactions…', 0);

    try {
      if (requiresChunkedPipeline(file)) {
        await runChunkedRedactPipeline(file, redactions, ({ label, percent }) =>
          onProcessingChange(true, label, percent),
        );
        onProcessingChange(false, '', 0);
        onSuccess('Document redacted via Smart Slicing — download started.');
        onClose();
        return;
      }

      const { bytes, downloadName } = await redactPdfInBrowser(file, redactions, ({ current, total, label }) => {
        const percent = total > 0 ? Math.round((current / total) * 100) : 0;
        onProcessingChange(true, label, percent);
      });
      triggerPdfDownload(bytes, downloadName, '_redacted');
      onProcessingChange(false, '', 0);
      onSuccess(`Redacted ${totalBoxes} area(s) — secure PDF download started.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Redaction failed.');
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [file, onClose, onProcessingChange, onSuccess, redactions, totalBoxes]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="redact-pdf-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="redact-pdf-title" className="text-lg font-bold text-canvas-text">
              Secure Document Redactor
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
          Drag on the page to draw black boxes over sensitive text or images. Redactions are flattened into
          the PDF output.
        </p>

        {loadingMeta ? (
          <ToolProcessingWait label="Loading page preview…" className="mt-4" />
        ) : (
          <>
            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={busy || pageIndex <= 0}
                onClick={() => setPageIndex((p) => p - 1)}
                className="rounded-lg border border-canvas-border px-2 py-1 text-xs font-semibold text-slate-200 disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="text-xs font-semibold text-slate-200">
                Page {pageIndex + 1} of {pageCount} · {boxesForPage.length} box(es)
              </span>
              <button
                type="button"
                disabled={busy || pageIndex >= pageCount - 1}
                onClick={() => setPageIndex((p) => p + 1)}
                className="rounded-lg border border-canvas-border px-2 py-1 text-xs font-semibold text-slate-200 disabled:opacity-40"
              >
                Next →
              </button>
            </div>

            <div
              ref={overlayRef}
              className="relative mt-3 overflow-hidden rounded-xl border border-canvas-border bg-black/20"
              onPointerDown={(event) => {
                if (busy) return;
                const pt = pointerToNormalized(event.clientX, event.clientY);
                if (!pt) return;
                setDrag({ startX: pt.x, startY: pt.y, currentX: pt.x, currentY: pt.y });
                (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (!drag) return;
                const pt = pointerToNormalized(event.clientX, event.clientY);
                if (!pt) return;
                setDrag((d) => (d ? { ...d, currentX: pt.x, currentY: pt.y } : d));
              }}
              onPointerUp={() => {
                if (!drag) return;
                const x = Math.min(drag.startX, drag.currentX);
                const y = Math.min(drag.startY, drag.currentY);
                const w = Math.abs(drag.currentX - drag.startX);
                const h = Math.abs(drag.currentY - drag.startY);
                addBox({ x, y, w, h });
                setDrag(null);
              }}
            >
              {previewUrl && (
                <img src={previewUrl} alt={`Page ${pageIndex + 1}`} className="block w-full select-none" draggable={false} />
              )}
              {boxesForPage.map((box, i) => (
                <div
                  key={`${pageIndex}-${i}`}
                  className="pointer-events-none absolute border border-black bg-black"
                  style={{
                    left: `${box.x * 100}%`,
                    top: `${box.y * 100}%`,
                    width: `${box.w * 100}%`,
                    height: `${box.h * 100}%`,
                  }}
                />
              ))}
              {drag && (
                <div
                  className="pointer-events-none absolute border-2 border-dashed border-rose-300 bg-black/70"
                  style={{
                    left: `${Math.min(drag.startX, drag.currentX) * 100}%`,
                    top: `${Math.min(drag.startY, drag.currentY) * 100}%`,
                    width: `${Math.abs(drag.currentX - drag.startX) * 100}%`,
                    height: `${Math.abs(drag.currentY - drag.startY) * 100}%`,
                  }}
                />
              )}
            </div>

            <div className="mt-2 flex justify-between">
              <span className="text-xs text-slate-300">{totalBoxes} total redaction(s)</span>
              <button
                type="button"
                onClick={clearPageBoxes}
                disabled={busy || boxesForPage.length === 0}
                className="text-xs font-semibold text-rose-200 underline disabled:opacity-40"
              >
                Clear this page
              </button>
            </div>
          </>
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
            onClick={() => void handleApply()}
            disabled={busy || loadingMeta}
            className="rounded-xl bg-canvas-accent-muted px-4 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Redacting…' : 'Apply redactions & download'}
          </button>
        </div>
      </div>
    </div>
  );
}
