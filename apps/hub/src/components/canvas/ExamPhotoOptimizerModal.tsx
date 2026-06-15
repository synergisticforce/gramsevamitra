import { useCallback, useEffect, useState } from 'react';
import { formatFileSize } from '../../lib/canvas/documentCanvasStorage';
import { processExamPhotoInBrowser } from '../../lib/canvas/mediaExamPhoto';
import { triggerImageDownload } from '../../lib/canvas/mediaImageTools';

interface Props {
  file: File;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

export default function ExamPhotoOptimizerModal({
  file,
  onClose,
  onSuccess,
  onProcessingChange,
}: Props) {
  const [degrees, setDegrees] = useState(0);
  const [threshold, setThreshold] = useState(128);
  const [autoCrop, setAutoCrop] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const timer = window.setTimeout(() => {
      void (async () => {
        setPreviewLoading(true);
        try {
          const { blob } = await processExamPhotoInBrowser(file, {
            degrees,
            threshold,
            autoCrop,
          });
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          setPreviewUrl(objectUrl);
        } catch {
          if (!cancelled) setPreviewUrl(null);
        } finally {
          if (!cancelled) setPreviewLoading(false);
        }
      })();
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file, degrees, threshold, autoCrop]);

  const handleProcess = useCallback(async () => {
    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Preparing exam scan…', 0);

    try {
      const { blob, downloadName } = await processExamPhotoInBrowser(
        file,
        { degrees, threshold, autoCrop },
        ({ label, percent }) => onProcessingChange(true, label, percent)
      );

      triggerImageDownload(blob, downloadName, '_scanned');
      onProcessingChange(false, '', 0);
      onSuccess(`Exam photo optimized — scanned B&W document ready. Download started.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed.');
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [autoCrop, degrees, file, onClose, onProcessingChange, onSuccess, threshold]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exam-photo-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="exam-photo-title" className="text-lg font-bold text-canvas-text">
              Exam Photo Optimizer
            </h2>
            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-300 truncate">
              {file.name} · {formatFileSize(file.size)}
            </p>
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
          Creates a clean scanned-document look with B&amp;W threshold, auto-crop, and deskew — 100%
          client-side.
        </p>

        <div className="mt-4 overflow-hidden rounded-xl border border-canvas-border bg-canvas-elevated">
          {previewLoading ? (
            <p className="px-4 py-12 text-center text-sm font-medium leading-relaxed text-slate-200">Generating preview…</p>
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt="Scanned document preview"
              className="mx-auto max-h-48 w-full object-contain"
            />
          ) : (
            <p className="px-4 py-12 text-center text-sm font-medium leading-relaxed text-slate-200">Preview unavailable</p>
          )}
        </div>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
              Deskew rotation ({degrees}°)
            </span>
            <input
              type="range"
              min={-15}
              max={15}
              step={0.5}
              value={degrees}
              onChange={(event) => setDegrees(Number(event.target.value))}
              disabled={busy}
              className="mt-2 w-full accent-violet-600"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
              B&amp;W threshold ({threshold})
            </span>
            <input
              type="range"
              min={80}
              max={200}
              step={1}
              value={threshold}
              onChange={(event) => setThreshold(Number(event.target.value))}
              disabled={busy}
              className="mt-2 w-full accent-violet-600"
            />
          </label>

          <label className="flex items-center gap-2 text-sm font-medium leading-relaxed text-slate-200">
            <input
              type="checkbox"
              checked={autoCrop}
              onChange={(event) => setAutoCrop(event.target.checked)}
              disabled={busy}
              className="rounded accent-violet-600"
            />
            Auto-crop white margins
          </label>
        </div>

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
            onClick={() => void handleProcess()}
            disabled={busy}
            className="rounded-xl bg-canvas-accent-muted px-4 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Processing…' : 'Scan & download'}
          </button>
        </div>
      </div>
    </div>
  );
}
