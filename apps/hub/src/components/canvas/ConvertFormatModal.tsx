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
      className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="convert-format-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="convert-format-title" className="text-lg font-bold text-slate-900">
              Convert Format
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
                    ? 'border-violet-400 bg-violet-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
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
                  <span className="block text-sm font-semibold text-slate-900">{item.label}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{item.description}</span>
                </span>
              </label>
            );
          })}
        </div>

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
            onClick={() => void handleConvert()}
            disabled={busy}
            className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Converting…' : 'Convert & download'}
          </button>
        </div>
      </div>
    </div>
  );
}
