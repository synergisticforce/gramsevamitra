import { useEffect, useRef, useState } from 'react';
import { formatFileSize } from '../../lib/canvas/documentCanvasStorage';
import type { EnhanceMode } from '../../lib/canvas/imageEnhance';
import { downloadBlob } from '@shared/utils/fileUtils';

interface Props {
  file: File;
  mode: EnhanceMode;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const COPY: Record<EnhanceMode, { title: string; body: string }> = {
  'upscale-2x': {
    title: 'Upscale 2×',
    body: 'Doubles the photo on this device. Smaller photos can use an on-device sharpening model. Larger photos use a high-quality resize. Nothing is uploaded.',
  },
  'upscale-4x': {
    title: 'Upscale 4×',
    body: 'Quadruples the photo on this device, in tiles, with a high-quality resize when the AI model is too heavy for this picture. Nothing is uploaded.',
  },
  restore: {
    title: 'AI Restore',
    body: 'Lifts shadows, stretches contrast, and denoises faded receipts, IDs, and compressed photos on this device. Nothing is uploaded.',
  },
};

export default function ImageEnhanceModal({ file, mode, onClose, onSuccess }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState('Ready');
  const [percent, setPercent] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const copy = COPY[mode];

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleRun = () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    setPercent(2);
    setLabel('Starting…');

    void (async () => {
      try {
        const { enhanceImageInBrowser } = await import('../../lib/canvas/imageEnhance');
        const result = await enhanceImageInBrowser(
          file,
          mode,
          ({ label: nextLabel, percent: nextPercent }) => {
            setLabel(nextLabel);
            setPercent(nextPercent);
          },
          controller.signal,
        );
        setPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return URL.createObjectURL(result.blob);
        });
        downloadBlob(result.blob, result.downloadName);
        const engineLabel =
          result.engine === 'ai'
            ? 'on-device AI model'
            : result.engine === 'restore'
              ? 'on-device restore'
              : 'high-quality resize';
        onSuccess(`${copy.title} complete — ${result.width}×${result.height} px (${engineLabel}). ₹0 charged.`);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          setError(null);
          setLabel('Cancelled');
          setPercent(0);
          return;
        }
        setError(err instanceof Error ? err.message : 'Could not enhance this image.');
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    })();
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-enhance-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-canvas-border bg-canvas-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="image-enhance-title" className="text-lg font-bold text-canvas-text">
              {copy.title}
            </h2>
            <p className="mt-1 truncate text-xs font-medium leading-relaxed text-slate-300">
              {file.name} · {formatFileSize(file.size)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-canvas-subtle transition hover:bg-canvas-elevated disabled:opacity-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className="mt-3 text-sm font-medium leading-relaxed text-slate-200">{copy.body}</p>

        {previewUrl && (
          <img src={previewUrl} alt="Enhanced preview" className="mt-4 max-h-64 w-full rounded-xl object-contain" />
        )}

        {busy && (
          <div className="mt-4">
            <p className="text-sm font-medium text-slate-200">{label}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-canvas-elevated">
              <div className="h-full rounded-full bg-canvas-accent" style={{ width: `${Math.min(100, percent)}%` }} />
            </div>
            <p className="mt-1 text-right text-xs text-canvas-subtle">{Math.round(percent)}%</p>
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-lg border border-canvas-border bg-canvas-danger-soft/30 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {busy ? (
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-xl border border-canvas-border px-4 py-2.5 text-sm font-semibold text-canvas-muted"
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-canvas-border px-4 py-2.5 text-sm font-semibold text-canvas-muted"
            >
              Close
            </button>
          )}
          <button
            type="button"
            onClick={handleRun}
            disabled={busy}
            className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Run on this device'}
          </button>
        </div>
      </div>
    </div>
  );
}
