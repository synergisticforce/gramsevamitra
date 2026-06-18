import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  cropImageInBrowser,
  readImageDimensions,
  triggerImageDownload,
} from '../../lib/canvas/mediaImageTools';
import { useModalMetaLoading } from '../../lib/canvas/useModalMetaLoading';
import ToolProcessingWait from './ToolProcessingWait';

interface Props {
  file: File;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

const INPUT_CLASS =
  'w-full rounded-xl border border-canvas-border bg-canvas-surface px-3 py-2.5 text-sm text-slate-200 outline-none ring-violet-500/30 focus:border-violet-400 focus:ring-2 tabular-nums';

export default function ImageCropperModal({
  file,
  onClose,
  onSuccess,
  onProcessingChange,
}: Props) {
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [cropW, setCropW] = useState(100);
  const [cropH, setCropH] = useState(100);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useModalMetaLoading(loadingMeta, busy, onProcessingChange, 'Reading image dimensions… Please wait');

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMeta(true);
      try {
        const dims = await readImageDimensions(file);
        if (cancelled) return;
        setNaturalSize({ width: dims.width, height: dims.height });
        setCropW(dims.width);
        setCropH(dims.height);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not read image.');
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  const overlayStyle = useMemo(() => {
    if (!naturalSize) return null;
    const left = (cropX / naturalSize.width) * 100;
    const top = (cropY / naturalSize.height) * 100;
    const width = (cropW / naturalSize.width) * 100;
    const height = (cropH / naturalSize.height) * 100;
    return { left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` };
  }, [cropH, cropW, cropX, cropY, naturalSize]);

  const handleCrop = useCallback(async () => {
    if (!naturalSize || busy) return;
    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Cropping image…', 20);
    try {
      const { blob, downloadName } = await cropImageInBrowser(
        file,
        { x: cropX, y: cropY, width: cropW, height: cropH },
        ({ percent }) => onProcessingChange(true, 'Cropping image…', percent),
      );
      triggerImageDownload(blob, downloadName, '_cropped');
      onProcessingChange(false, '', 0);
      onSuccess(`Cropped image downloaded — ${downloadName}`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Crop failed.');
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [busy, cropH, cropW, cropX, cropY, file, naturalSize, onClose, onProcessingChange, onSuccess]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-cropper-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="image-cropper-title" className="text-lg font-bold text-canvas-text">
              ✂️ Crop Image
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

        {previewUrl && naturalSize && overlayStyle && (
          <div className="relative mt-4 overflow-hidden rounded-xl border border-canvas-border bg-canvas-elevated">
            <img src={previewUrl} alt="Crop preview" className="block max-h-56 w-full object-contain" />
            <div
              className="pointer-events-none absolute border-2 border-violet-400 bg-violet-500/20"
              style={overlayStyle}
            />
          </div>
        )}

        {naturalSize && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-200">Left (px)</span>
              <input
                type="number"
                min={0}
                max={naturalSize.width - 1}
                value={cropX}
                disabled={busy}
                onChange={(e) => setCropX(Number(e.target.value))}
                className={INPUT_CLASS}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-200">Top (px)</span>
              <input
                type="number"
                min={0}
                max={naturalSize.height - 1}
                value={cropY}
                disabled={busy}
                onChange={(e) => setCropY(Number(e.target.value))}
                className={INPUT_CLASS}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-200">Width (px)</span>
              <input
                type="number"
                min={1}
                max={naturalSize.width - cropX}
                value={cropW}
                disabled={busy}
                onChange={(e) => setCropW(Number(e.target.value))}
                className={INPUT_CLASS}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-200">Height (px)</span>
              <input
                type="number"
                min={1}
                max={naturalSize.height - cropY}
                value={cropH}
                disabled={busy}
                onChange={(e) => setCropH(Number(e.target.value))}
                className={INPUT_CLASS}
              />
            </label>
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-lg border border-canvas-border bg-canvas-danger-soft/30 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}

        {loadingMeta && !naturalSize && <ToolProcessingWait label="Reading image…" />}

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
            onClick={() => void handleCrop()}
            disabled={busy || !naturalSize}
            className="rounded-xl bg-canvas-accent-muted px-4 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Cropping…' : 'Crop & download'}
          </button>
        </div>
      </div>
    </div>
  );
}
