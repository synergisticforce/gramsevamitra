import { useCallback, useState } from 'react';
import { formatFileSize } from '../../lib/canvas/documentCanvasStorage';
import {
  convertImageFormatInBrowser,
  triggerImageDownload,
  type OutputImageFormat,
} from '../../lib/canvas/mediaImageTools';

interface Props {
  file: File;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

const FORMATS: { id: OutputImageFormat; label: string; description: string }[] = [
  { id: 'jpeg', label: 'JPG', description: 'Best for photos and smaller file sizes.' },
  { id: 'png', label: 'PNG', description: 'Lossless — ideal for graphics and transparency.' },
  { id: 'webp', label: 'WebP', description: 'Modern format with excellent compression.' },
];

export default function ConvertFormatModal({
  file,
  onClose,
  onSuccess,
  onProcessingChange,
}: Props) {
  const [format, setFormat] = useState<OutputImageFormat>('jpeg');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConvert = useCallback(async () => {
    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Loading image…', 0);

    try {
      const { blob, downloadName } = await convertImageFormatInBrowser(
        file,
        format,
        ({ label, percent }) => onProcessingChange(true, label, percent)
      );

      triggerImageDownload(blob, downloadName, '_converted');
      onProcessingChange(false, '', 0);
      onSuccess(
        `Format conversion complete — saved as ${downloadName} (${formatFileSize(blob.size)}). Download started.`
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed.');
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [file, format, onClose, onProcessingChange, onSuccess]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="convert-format-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="convert-format-title" className="text-lg font-bold text-canvas-text">
              Convert Format
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
          Redraws your image on an HTML5 canvas and exports locally — no server upload.
        </p>

        <div className="mt-3 space-y-2">
          {FORMATS.map((item) => {
            const selected = format === item.id;
            return (
              <label
                key={item.id}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition ${
                  selected
                    ? 'border-violet-400 bg-canvas-accent-soft'
                    : 'border-canvas-border bg-canvas-surface hover:border-canvas-border'
                }`}
              >
                <input
                  type="radio"
                  name="output-format"
                  value={item.id}
                  checked={selected}
                  onChange={() => setFormat(item.id)}
                  disabled={busy}
                  className="mt-1 accent-violet-600"
                />
                <span>
                  <span className="block text-sm font-semibold text-canvas-text">{item.label}</span>
                  <span className="mt-0.5 block text-xs font-medium leading-relaxed text-slate-300">{item.description}</span>
                </span>
              </label>
            );
          })}
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
            onClick={() => void handleConvert()}
            disabled={busy}
            className="rounded-xl bg-canvas-accent-muted px-4 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Converting…' : 'Convert & download'}
          </button>
        </div>
      </div>
    </div>
  );
}
