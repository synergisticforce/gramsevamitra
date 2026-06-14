import { useCallback, useEffect, useState } from 'react';
import { cropPdfInBrowser, getPdfPageSize, triggerPdfDownload } from '../../lib/canvas/documentPdfTools';
import { defaultCropRect, type NormalizedCropRect } from '../../lib/pdf/cropCoords';

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
      className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-pdf-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="crop-pdf-title" className="text-lg font-bold text-slate-900">
              Crop PDF Page
            </h2>
            <p className="mt-1 text-xs text-slate-500 truncate">{file.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {loadingMeta ? (
          <p className="mt-4 text-sm text-slate-500">Reading document…</p>
        ) : (
          <>
            <label className="mt-4 block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
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
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none ring-emerald-500/30 focus:border-emerald-400 focus:ring-2 tabular-nums disabled:bg-slate-50"
              />
            </label>

            <p className="mt-4 text-sm text-slate-600">
              Adjust the crop area as percentages of the page (top-left origin).
            </p>

            {(['x', 'y', 'w', 'h'] as const).map((key) => (
              <label key={key} className="mt-3 block">
                <div className="mb-1 flex justify-between text-xs text-slate-600">
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
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={busy || loadingMeta || pageCount < 1}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Cropping…' : 'Apply & download'}
          </button>
        </div>
      </div>
    </div>
  );
}
