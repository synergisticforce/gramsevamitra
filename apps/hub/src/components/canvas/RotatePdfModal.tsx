import { useCallback, useEffect, useState } from 'react';
import {
  rotatePdfPagesInBrowser,
  triggerPdfDownload,
  type PageRotationAngle,
} from '../../lib/canvas/documentPdfTools';
import { useModalMetaLoading } from '../../lib/canvas/useModalMetaLoading';
import ToolProcessingWait from './ToolProcessingWait';

interface Props {
  file: File;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

const ROTATION_OPTIONS: { value: PageRotationAngle; label: string }[] = [
  { value: 0, label: '0°' },
  { value: 90, label: '90°' },
  { value: 180, label: '180°' },
  { value: 270, label: '270°' },
];

export default function RotatePdfModal({ file, onClose, onSuccess, onProcessingChange }: Props) {
  const [pageCount, setPageCount] = useState(0);
  const [rotations, setRotations] = useState<PageRotationAngle[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useModalMetaLoading(loadingMeta, busy, onProcessingChange, 'Reading page count… Please wait');

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
        setRotations(Array.from({ length: count }, () => 0));
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

  const setPageRotation = (pageIndex: number, angle: PageRotationAngle) => {
    setRotations((prev) => {
      const next = [...prev];
      next[pageIndex] = angle;
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
    const pageRotations = rotations
      .map((angle, pageIndex) => ({ pageIndex, angle }))
      .filter((r) => r.angle > 0);

    if (pageRotations.length === 0) {
      setError('Set a rotation angle for at least one page.');
      return;
    }

    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Rotating pages…', 0);

    try {
      const { bytes, downloadName, rotatedCount } = await rotatePdfPagesInBrowser(
        file,
        pageRotations,
        ({ current, total, label }) => reportProgress(current, total, label)
      );
      triggerPdfDownload(bytes, downloadName, '_rotated');
      onProcessingChange(false, '', 0);
      onSuccess(`Rotated ${rotatedCount} page(s) — download started.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rotation failed.');
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [file, onClose, onProcessingChange, onSuccess, reportProgress, rotations]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rotate-pdf-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="rotate-pdf-title" className="text-lg font-bold text-canvas-text">
              Rotate PDF Pages
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
          <ToolProcessingWait label="Reading page count…" className="mt-4" />
        ) : (
          <>
            <p className="mt-4 text-sm font-medium leading-relaxed text-slate-200">
              Choose a rotation for each page. Only changed pages are processed.
            </p>
            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {Array.from({ length: pageCount }, (_, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-xl border border-canvas-border bg-canvas-elevated px-3 py-2"
                >
                  <span className="text-sm font-medium text-canvas-text">Page {i + 1}</span>
                  <select
                    value={rotations[i] ?? 0}
                    disabled={busy}
                    onChange={(e) => setPageRotation(i, Number(e.target.value) as PageRotationAngle)}
                    className="rounded-lg border border-canvas-border bg-canvas-surface px-2 py-1 text-sm text-canvas-text"
                  >
                    {ROTATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
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
            {busy ? 'Rotating…' : 'Apply & download'}
          </button>
        </div>
      </div>
    </div>
  );
}
