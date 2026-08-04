import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatFileSize } from '../../lib/canvas/documentCanvasStorage';
import {
  EXAM_PRESETS,
  processExamPhotoInBrowser,
  type ExamOutputMode,
  type ExamPhotoResult,
} from '../../lib/canvas/mediaExamPhoto';
import { triggerImageDownload } from '../../lib/canvas/mediaImageTools';

interface Props {
  file: File;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

const CUSTOM = 'custom';

export default function ExamPhotoOptimizerModal({
  file,
  onClose,
  onSuccess,
  onProcessingChange,
}: Props) {
  const [presetId, setPresetId] = useState(EXAM_PRESETS[0].id);
  const [width, setWidth] = useState(EXAM_PRESETS[0].width);
  const [height, setHeight] = useState(EXAM_PRESETS[0].height);
  const [maxKb, setMaxKb] = useState(EXAM_PRESETS[0].maxKb);
  const [minKb, setMinKb] = useState(EXAM_PRESETS[0].minKb ?? 0);
  const [mode, setMode] = useState<ExamOutputMode>('colour');
  const [degrees, setDegrees] = useState(0);
  const [autoCrop, setAutoCrop] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMeta, setPreviewMeta] = useState<ExamPhotoResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const options = useMemo(
    () => ({ degrees, autoCrop, mode, width, height, maxKb, minKb: minKb || undefined }),
    [autoCrop, degrees, height, maxKb, minKb, mode, width],
  );

  const applyPreset = useCallback((id: string) => {
    setPresetId(id);
    const preset = EXAM_PRESETS.find((item) => item.id === id);
    if (!preset) return;
    setWidth(preset.width);
    setHeight(preset.height);
    setMaxKb(preset.maxKb);
    setMinKb(preset.minKb ?? 0);
    // Signatures need high contrast; photos must keep their colour.
    setMode(preset.kind === 'signature' ? 'bw' : 'colour');
    setAutoCrop(preset.kind === 'signature');
  }, []);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const timer = window.setTimeout(() => {
      void (async () => {
        setPreviewLoading(true);
        try {
          const result = await processExamPhotoInBrowser(file, options);
          if (cancelled) return;
          objectUrl = URL.createObjectURL(result.blob);
          setPreviewUrl(objectUrl);
          setPreviewMeta(result);
        } catch {
          if (!cancelled) {
            setPreviewUrl(null);
            setPreviewMeta(null);
          }
        } finally {
          if (!cancelled) setPreviewLoading(false);
        }
      })();
    }, 320);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file, options]);

  const handleProcess = useCallback(async () => {
    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Preparing your photo…', 0);

    try {
      const result = await processExamPhotoInBrowser(file, options, ({ label, percent }) =>
        onProcessingChange(true, label, percent),
      );

      triggerImageDownload(result.blob, result.downloadName, '_optimized');
      onProcessingChange(false, '', 0);
      onSuccess(
        result.withinTarget
          ? `Ready — ${result.width}×${result.height} px, ${result.sizeKb} KB.`
          : `Saved at ${result.width}×${result.height} px, ${result.sizeKb} KB. This is above the ${maxKb} KB limit — try smaller dimensions.`,
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed.');
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [file, maxKb, onClose, onProcessingChange, onSuccess, options]);

  const inputClass =
    'mt-1 min-h-11 w-full rounded-xl border border-canvas-border bg-canvas-elevated px-3 text-sm text-canvas-text outline-none focus:border-canvas-accent';

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exam-photo-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-canvas-border bg-canvas-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="exam-photo-title" className="text-lg font-bold text-canvas-text">
              Exam Photo &amp; Signature
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

        <p className="mt-3 text-sm font-medium leading-relaxed text-slate-200">
          Pick your exam. The photo is resized to the exact size required and compressed to fit the
          KB limit — all on your phone.
        </p>

        <div className="mt-4 overflow-hidden rounded-xl border border-canvas-border bg-canvas-elevated">
          {previewLoading ? (
            <p className="px-4 py-12 text-center text-sm font-medium text-slate-200">
              Generating preview…
            </p>
          ) : previewUrl ? (
            <div className="flex flex-col items-center gap-2 p-4">
              <img
                src={previewUrl}
                alt="Exam photo preview"
                className="max-h-48 rounded-lg border border-canvas-border bg-white object-contain"
              />
              {previewMeta && (
                <p
                  className={`text-xs font-semibold ${
                    previewMeta.withinTarget ? 'text-emerald-300' : 'text-amber-300'
                  }`}
                >
                  {previewMeta.width}×{previewMeta.height} px · {previewMeta.sizeKb} KB
                  {previewMeta.withinTarget ? ' · fits the limit' : ` · over ${maxKb} KB`}
                </p>
              )}
            </div>
          ) : (
            <p className="px-4 py-12 text-center text-sm font-medium text-slate-200">
              Preview unavailable
            </p>
          )}
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
            Exam requirement
          </span>
          <select
            value={presetId}
            onChange={(event) => {
              if (event.target.value === CUSTOM) setPresetId(CUSTOM);
              else applyPreset(event.target.value);
            }}
            disabled={busy}
            className={inputClass}
          >
            {EXAM_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label} — {preset.width}×{preset.height}, {preset.minKb ?? 0}–{preset.maxKb} KB
              </option>
            ))}
            <option value={CUSTOM}>Custom size</option>
          </select>
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
              Width (px)
            </span>
            <input
              type="number"
              min={20}
              max={4000}
              value={width}
              onChange={(event) => {
                setPresetId(CUSTOM);
                setWidth(Math.max(20, Number(event.target.value) || 20));
              }}
              disabled={busy}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
              Height (px)
            </span>
            <input
              type="number"
              min={20}
              max={4000}
              value={height}
              onChange={(event) => {
                setPresetId(CUSTOM);
                setHeight(Math.max(20, Number(event.target.value) || 20));
              }}
              disabled={busy}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
              Min size (KB)
            </span>
            <input
              type="number"
              min={0}
              max={5000}
              value={minKb}
              onChange={(event) => setMinKb(Math.max(0, Number(event.target.value) || 0))}
              disabled={busy}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
              Max size (KB)
            </span>
            <input
              type="number"
              min={5}
              max={5000}
              value={maxKb}
              onChange={(event) => setMaxKb(Math.max(5, Number(event.target.value) || 5))}
              disabled={busy}
              className={inputClass}
            />
          </label>
        </div>

        <div className="mt-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
            Colour
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                { id: 'colour', label: 'Keep colour' },
                { id: 'grayscale', label: 'Grayscale' },
                { id: 'bw', label: 'Black & white' },
              ] as Array<{ id: ExamOutputMode; label: string }>
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setMode(option.id)}
                disabled={busy}
                aria-pressed={mode === option.id}
                className={`inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-semibold transition disabled:opacity-50 ${
                  mode === option.id
                    ? 'border-canvas-accent bg-canvas-accent-soft text-canvas-text'
                    : 'border-canvas-border bg-canvas-surface text-canvas-muted'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs font-medium leading-relaxed text-slate-400">
            Use “Keep colour” for photographs. Black &amp; white suits signatures on white paper.
          </p>
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
            Straighten ({degrees}°)
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

        <label className="mt-3 flex min-h-11 items-center gap-2 text-sm font-medium text-slate-200">
          <input
            type="checkbox"
            checked={autoCrop}
            onChange={(event) => setAutoCrop(event.target.checked)}
            disabled={busy}
            className="h-5 w-5 rounded accent-violet-600"
          />
          Trim blank white margins first
        </label>

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
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-canvas-border px-5 text-sm font-semibold text-canvas-muted transition hover:bg-canvas-elevated disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleProcess()}
            disabled={busy}
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-canvas-accent-muted px-5 text-sm font-bold text-canvas-text transition hover:bg-canvas-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Processing…' : 'Save photo'}
          </button>
        </div>
      </div>
    </div>
  );
}
