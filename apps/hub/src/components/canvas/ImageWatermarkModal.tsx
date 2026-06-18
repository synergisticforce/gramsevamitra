import { useCallback, useState } from 'react';
import {
  triggerImageDownload,
  watermarkImageInBrowser,
  type WatermarkPosition,
} from '../../lib/canvas/mediaImageTools';

interface Props {
  file: File;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

const POSITIONS: { id: WatermarkPosition; label: string }[] = [
  { id: 'top-left', label: 'Top left' },
  { id: 'top-right', label: 'Top right' },
  { id: 'bottom-left', label: 'Bottom left' },
  { id: 'bottom-right', label: 'Bottom right' },
  { id: 'center', label: 'Center' },
];

const INPUT_CLASS =
  'w-full rounded-xl border border-canvas-border bg-canvas-surface px-3 py-2.5 text-sm text-slate-200 outline-none ring-violet-500/30 focus:border-violet-400 focus:ring-2';

export default function ImageWatermarkModal({
  file,
  onClose,
  onSuccess,
  onProcessingChange,
}: Props) {
  const [text, setText] = useState('© GramSeva Mitra');
  const [fontSize, setFontSize] = useState(32);
  const [opacity, setOpacity] = useState(0.65);
  const [position, setPosition] = useState<WatermarkPosition>('bottom-right');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApply = useCallback(async () => {
    if (busy) return;
    if (!text.trim() && !logoFile) {
      setError('Enter watermark text or upload a logo.');
      return;
    }
    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Applying watermark…', 10);
    try {
      const { blob, downloadName } = await watermarkImageInBrowser(
        file,
        { text, fontSize, opacity, position, logoFile },
        ({ percent, label }) => onProcessingChange(true, label, percent),
      );
      triggerImageDownload(blob, downloadName, '_watermarked');
      onProcessingChange(false, '', 0);
      onSuccess(`Watermarked image downloaded — ${downloadName}`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Watermark failed.');
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [busy, file, fontSize, logoFile, onClose, onProcessingChange, onSuccess, opacity, position, text]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-watermark-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="image-watermark-title" className="text-lg font-bold text-canvas-text">
              💧 Watermark Image
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

        <div className="mt-4 space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-200">Watermark text</span>
            <input
              value={text}
              disabled={busy}
              onChange={(e) => setText(e.target.value)}
              placeholder="Your name or copyright notice"
              className={INPUT_CLASS}
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-200">Logo overlay (optional PNG/JPG)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-canvas-elevated file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-200"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-200">Font size: {fontSize}px</span>
            <input
              type="range"
              min={16}
              max={96}
              value={fontSize}
              disabled={busy}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full accent-violet-500"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-200">Opacity: {Math.round(opacity * 100)}%</span>
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              value={opacity}
              disabled={busy}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="w-full accent-violet-500"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {POSITIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={busy}
                onClick={() => setPosition(item.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  position === item.id
                    ? 'bg-canvas-accent-muted text-white'
                    : 'border border-canvas-border bg-canvas-surface text-slate-200 hover:bg-canvas-elevated'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
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
            onClick={() => void handleApply()}
            disabled={busy}
            className="rounded-xl bg-canvas-accent-muted px-4 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Applying…' : 'Apply & download'}
          </button>
        </div>
      </div>
    </div>
  );
}
