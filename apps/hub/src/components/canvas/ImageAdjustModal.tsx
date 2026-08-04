import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatFileSize } from '../../lib/canvas/documentCanvasStorage';
import {
  DEFAULT_ADJUST,
  adjustImageInBrowser,
  isDefaultAdjust,
  type AdjustValues,
} from '../../lib/canvas/mediaAdjust';
import { triggerImageDownload } from '../../lib/canvas/mediaImageTools';

interface Props {
  file: File;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

const ROTATIONS: Array<AdjustValues['rotation']> = [0, 90, 180, 270];

export default function ImageAdjustModal({
  file,
  onClose,
  onSuccess,
  onProcessingChange,
}: Props) {
  const [values, setValues] = useState<AdjustValues>(DEFAULT_ADJUST);
  const [autoEnhance, setAutoEnhance] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const previewOptions = useMemo(
    () => ({ ...values, autoEnhance, maxEdge: 900, quality: 0.8 }),
    [autoEnhance, values],
  );

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const timer = window.setTimeout(() => {
      void (async () => {
        setPreviewLoading(true);
        try {
          const { blob } = await adjustImageInBrowser(file, previewOptions);
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          setPreviewUrl(objectUrl);
        } catch {
          if (!cancelled) setPreviewUrl(null);
        } finally {
          if (!cancelled) setPreviewLoading(false);
        }
      })();
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file, previewOptions]);

  const handleSave = useCallback(async () => {
    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Applying adjustments…', 0);
    try {
      const result = await adjustImageInBrowser(
        file,
        { ...values, autoEnhance },
        ({ label, percent }) => onProcessingChange(true, label, percent),
      );
      triggerImageDownload(result.blob, result.downloadName, '_filtered');
      onProcessingChange(false, '', 0);
      onSuccess(`Photo adjusted — ${result.width}×${result.height} px.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not adjust this photo.');
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [autoEnhance, file, onClose, onProcessingChange, onSuccess, values]);

  const slider = (
    key: 'brightness' | 'contrast' | 'saturation',
    label: string,
  ) => (
    <label className="block">
      <span className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
        <span>{label}</span>
        <span className="tabular-nums text-canvas-muted">{values[key]}%</span>
      </span>
      <input
        type="range"
        min={20}
        max={200}
        step={1}
        value={values[key]}
        disabled={busy}
        onChange={(event) =>
          setValues((current) => ({ ...current, [key]: Number(event.target.value) }))
        }
        className="mt-2 h-6 w-full accent-violet-600"
      />
    </label>
  );

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-adjust-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-canvas-border bg-canvas-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="image-adjust-title" className="text-lg font-bold text-canvas-text">
              Adjust &amp; Rotate
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

        <div className="mt-4 flex min-h-40 items-center justify-center overflow-hidden rounded-xl border border-canvas-border bg-canvas-elevated p-3">
          {previewLoading ? (
            <p className="text-sm font-medium text-slate-200">Updating preview…</p>
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt="Adjusted preview"
              className="max-h-56 max-w-full rounded-lg object-contain"
            />
          ) : (
            <p className="text-sm font-medium text-slate-200">Preview unavailable</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setAutoEnhance((current) => !current)}
          disabled={busy}
          aria-pressed={autoEnhance}
          className={`mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl border px-4 text-sm font-bold transition disabled:opacity-50 ${
            autoEnhance
              ? 'border-canvas-accent bg-canvas-accent-soft text-canvas-text'
              : 'border-canvas-border bg-canvas-elevated text-canvas-text'
          }`}
        >
          {autoEnhance ? '✓ Auto-enhance on' : 'Auto-enhance'}
        </button>

        <div className="mt-4 space-y-4">
          {slider('brightness', 'Brightness')}
          {slider('contrast', 'Contrast')}
          {slider('saturation', 'Colour')}
        </div>

        <div className="mt-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
            Rotate
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {ROTATIONS.map((degrees) => (
              <button
                key={degrees}
                type="button"
                onClick={() => setValues((current) => ({ ...current, rotation: degrees }))}
                disabled={busy}
                aria-pressed={values.rotation === degrees}
                className={`inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-semibold transition disabled:opacity-50 ${
                  values.rotation === degrees
                    ? 'border-canvas-accent bg-canvas-accent-soft text-canvas-text'
                    : 'border-canvas-border bg-canvas-surface text-canvas-muted'
                }`}
              >
                {degrees}°
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setValues((current) => ({ ...current, flipHorizontal: !current.flipHorizontal }))
            }
            disabled={busy}
            aria-pressed={values.flipHorizontal}
            className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border px-4 text-sm font-semibold transition disabled:opacity-50 ${
              values.flipHorizontal
                ? 'border-canvas-accent bg-canvas-accent-soft text-canvas-text'
                : 'border-canvas-border bg-canvas-surface text-canvas-muted'
            }`}
          >
            Flip left–right
          </button>
          <button
            type="button"
            onClick={() =>
              setValues((current) => ({ ...current, flipVertical: !current.flipVertical }))
            }
            disabled={busy}
            aria-pressed={values.flipVertical}
            className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border px-4 text-sm font-semibold transition disabled:opacity-50 ${
              values.flipVertical
                ? 'border-canvas-accent bg-canvas-accent-soft text-canvas-text'
                : 'border-canvas-border bg-canvas-surface text-canvas-muted'
            }`}
          >
            Flip up–down
          </button>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-canvas-border bg-canvas-danger-soft/30 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => {
              setValues(DEFAULT_ADJUST);
              setAutoEnhance(false);
            }}
            disabled={busy || (isDefaultAdjust(values) && !autoEnhance)}
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-canvas-border px-5 text-sm font-semibold text-canvas-muted transition hover:bg-canvas-elevated disabled:opacity-50"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={busy}
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-canvas-accent-muted px-5 text-sm font-bold text-canvas-text transition hover:bg-canvas-accent/40 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save photo'}
          </button>
        </div>
      </div>
    </div>
  );
}
