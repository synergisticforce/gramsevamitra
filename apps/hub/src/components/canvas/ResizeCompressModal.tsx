import { useCallback, useEffect, useState } from 'react';
import { formatFileSize } from '../../lib/canvas/documentCanvasStorage';
import {
  readImageDimensions,
  resizeCompressImageInBrowser,
  triggerImageDownload,
  type ResizeCompressMode,
} from '../../lib/canvas/mediaImageTools';

interface Props {
  file: File;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

export default function ResizeCompressModal({
  file,
  onClose,
  onSuccess,
  onProcessingChange,
}: Props) {
  const [mode, setMode] = useState<ResizeCompressMode>('dimensions');
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(600);
  const [lockAspect, setLockAspect] = useState(true);
  const [targetKb, setTargetKb] = useState(200);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMeta(true);
      try {
        const dims = await readImageDimensions(file);
        if (cancelled) return;
        setNaturalSize({ width: dims.width, height: dims.height });
        setWidth(dims.width);
        setHeight(dims.height);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not read image dimensions.');
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  const aspect = naturalSize ? naturalSize.width / naturalSize.height : 1;

  const updateWidth = useCallback(
    (next: number) => {
      const w = Math.max(32, Math.min(8192, next));
      setWidth(w);
      if (lockAspect && aspect > 0) {
        setHeight(Math.max(32, Math.min(8192, Math.round(w / aspect))));
      }
    },
    [aspect, lockAspect]
  );

  const updateHeight = useCallback(
    (next: number) => {
      const h = Math.max(32, Math.min(8192, next));
      setHeight(h);
      if (lockAspect && aspect > 0) {
        setWidth(Math.max(32, Math.min(8192, Math.round(h * aspect))));
      }
    },
    [aspect, lockAspect]
  );

  const handleProcess = useCallback(async () => {
    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Preparing image…', 0);

    try {
      const options =
        mode === 'file-size'
          ? { mode: 'file-size' as const, targetKb: targetKb }
          : {
              mode: 'dimensions' as const,
              width,
              height,
              lockAspect,
            };

      const { blob, downloadName, savingsLabel } = await resizeCompressImageInBrowser(
        file,
        options,
        ({ label, percent }) => onProcessingChange(true, label, percent)
      );

      triggerImageDownload(blob, downloadName, '_optimized');
      onProcessingChange(false, '', 0);
      onSuccess(`Resize & compress complete — ${savingsLabel}. Download started.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed.');
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [
    file,
    height,
    lockAspect,
    mode,
    onClose,
    onProcessingChange,
    onSuccess,
    targetKb,
    width,
  ]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resize-compress-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="resize-compress-title" className="text-lg font-bold text-slate-900">
              Resize &amp; Compress
            </h2>
            <p className="mt-1 text-xs text-slate-500 truncate">
              {file.name} · {formatFileSize(file.size)}
            </p>
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

        <p className="mt-4 text-sm text-slate-600">
          Processed locally with browser-image-compression — nothing is uploaded.
        </p>

        {loadingMeta ? (
          <p className="mt-3 text-sm text-slate-500">Reading image dimensions…</p>
        ) : naturalSize ? (
          <p className="mt-3 text-xs text-slate-500">
            Original: {naturalSize.width} × {naturalSize.height} px
          </p>
        ) : null}

        <div className="mt-4 space-y-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-3 py-3">
            <input
              type="radio"
              name="resize-mode"
              checked={mode === 'dimensions'}
              onChange={() => setMode('dimensions')}
              disabled={busy}
              className="mt-1 accent-violet-600"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">Target dimensions</span>
              <span className="mt-0.5 block text-xs text-slate-500">Set width and height in pixels</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-3 py-3">
            <input
              type="radio"
              name="resize-mode"
              checked={mode === 'file-size'}
              onChange={() => setMode('file-size')}
              disabled={busy}
              className="mt-1 accent-violet-600"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">Target file size</span>
              <span className="mt-0.5 block text-xs text-slate-500">Compress to a maximum KB size</span>
            </span>
          </label>
        </div>

        {mode === 'dimensions' && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Width (px)</span>
                <input
                  type="number"
                  min={32}
                  max={8192}
                  value={width}
                  onChange={(event) => updateWidth(Number(event.target.value))}
                  disabled={busy || loadingMeta}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-50"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Height (px)</span>
                <input
                  type="number"
                  min={32}
                  max={8192}
                  value={height}
                  onChange={(event) => updateHeight(Number(event.target.value))}
                  disabled={busy || loadingMeta || lockAspect}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-50"
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={lockAspect}
                onChange={(event) => setLockAspect(event.target.checked)}
                disabled={busy}
                className="rounded accent-violet-600"
              />
              Lock aspect ratio
            </label>
          </div>
        )}

        {mode === 'file-size' && (
          <label className="mt-4 block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Target max size (KB)
            </span>
            <input
              type="number"
              min={1}
              max={10240}
              value={targetKb}
              onChange={(event) => setTargetKb(Math.max(1, Number(event.target.value)))}
              disabled={busy}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-50"
            />
          </label>
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
            onClick={() => void handleProcess()}
            disabled={busy || loadingMeta}
            className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Processing…' : 'Optimize & download'}
          </button>
        </div>
      </div>
    </div>
  );
}
