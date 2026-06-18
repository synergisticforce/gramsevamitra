import { useCallback, useEffect, useState } from 'react';
import { cropPdfInBrowser, getPdfPageSize, triggerPdfDownload } from '../../lib/canvas/documentPdfTools';
import { defaultCropRect, type NormalizedCropRect } from '../../lib/pdf/cropCoords';
import { useModalMetaLoading } from '../../lib/canvas/useModalMetaLoading';
import ToolProcessingWait from './ToolProcessingWait';

interface Props {
  file: File;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

export default function CropPdfModal({ file, onClose, onSuccess, onProcessingChange }: Props) {
  const [pageCount, setPageCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [crop, setCrop] = useState<NormalizedCropRect>(defaultCropRect());
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useModalMetaLoading(loadingMeta, busy, onProcessingChange, 'Reading document… Please wait');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoadingMeta(true);
      setError(null);
      try {
        const { getPdfPageCountFromFile } = await import('../../lib/pdf/pdfWorkerClient');
        const count = await getPdfPageCountFromFile(file);
        if (cancelled) return;
        setPageCount(count);
        setPageIndex(0);
        setCrop(defaultCropRect());
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not read this PDF.');
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file]);

  const updateCrop = (patch: Partial<NormalizedCropRect>) => {
    setCrop((prev) => {
      const next = { ...prev, ...patch };
      next.x = Math.min(1 - next.w, Math.max(0, next.x));
      next.y = Math.min(1 - next.h, Math.max(0, next.y));
      next.w = Math.min(1 - next.x, Math.max(0.05, next.w));
      next.h = Math.min(1 - next.y, Math.max(0.05, next.h));
      return next;
    });
  };

  const reportProgress = useCallback(
    (current: number, total: number, label: string) => {
      const percent = total > 0 ? Math.round((current / total) * 100) : 0;
      onProcessingChange(true, label, percent);
    },
    [onProcessingChange]
  );

  const handleApply = useCallback(async () => {
    if (pageCount < 1) {
      setError('Could not read page count from this PDF.');
      return;
    }

    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Applying crop…', 0);

    try {
      const pageSize = await getPdfPageSize(file, pageIndex + 1);
      const { bytes, downloadName } = await cropPdfInBrowser(
        file,
        pageIndex,
        crop,
        pageSize.width,
        pageSize.height,
        ({ current, total, label }) => reportProgress(current, total, label)
      );
      triggerPdfDownload(bytes, downloadName, '_cropped');
      onProcessingChange(false, '', 0);
      onSuccess(`Crop applied to page ${pageIndex + 1}. Download started.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Crop failed.');
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [crop, file, onClose, onProcessingChange, onSuccess, pageCount, pageIndex, reportProgress]);

  const sliderClass = 'w-full accent-emerald-600';

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-pdf-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="crop-pdf-title" className="text-lg font-bold text-canvas-text">
              Crop PDF Page
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

        {loadingMeta ? (
          <ToolProcessingWait label="Reading document…" className="mt-4" />
        ) : (
          <>
            <label className="mt-4 block">
              <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
                Page to crop (1-based)
              </span>
              <input
                type="number"
                min={1}
                max={pageCount}
                value={pageIndex + 1}
                disabled={busy}
                onChange={(e) => {
                  const n = Math.max(1, Math.min(pageCount, Number(e.target.value) || 1));
                  setPageIndex(n - 1);
                  setCrop(defaultCropRect());
                }}
                className="mt-1.5 w-full rounded-xl border border-canvas-border px-3 py-2.5 text-sm text-canvas-text outline-none ring-canvas-accent/50/30 focus:border-canvas-accent focus:ring-2 tabular-nums disabled:bg-canvas-elevated"
              />
            </label>

            <p className="mt-4 text-sm font-medium leading-relaxed text-slate-200">
              Adjust the crop area as percentages of the page (top-left origin).
            </p>

            {(['x', 'y', 'w', 'h'] as const).map((key) => (
              <label key={key} className="mt-3 block">
                <div className="mb-1 flex justify-between text-xs text-canvas-muted">
                  <span className="font-medium uppercase">{key === 'w' ? 'Width' : key === 'h' ? 'Height' : key === 'x' ? 'Left offset' : 'Top offset'}</span>
                  <span className="tabular-nums">{Math.round(crop[key] * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={key === 'w' || key === 'h' ? 5 : 0}
                  max={100}
                  value={Math.round(crop[key] * 100)}
                  disabled={busy}
                  onChange={(e) => updateCrop({ [key]: Number(e.target.value) / 100 })}
                  className={sliderClass}
                />
              </label>
            ))}
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
            disabled={busy || loadingMeta || pageCount < 1}
            className="rounded-xl bg-canvas-accent-muted px-4 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Cropping…' : 'Apply & download'}
          </button>
        </div>
      </div>
    </div>
  );
}
