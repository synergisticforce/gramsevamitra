import { useCallback, useState } from 'react';
import { formatFileSize } from '../../lib/canvas/documentCanvasStorage';
import {
  COMPRESSION_PRESETS,
  compressPdfInBrowser,
  triggerPdfDownload,
  type CompressionPreset,
} from '../../lib/canvas/documentPdfTools';

interface Props {
  file: File;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

export default function CompressPdfModal({ file, onClose, onSuccess, onProcessingChange }: Props) {
  const [preset, setPreset] = useState<CompressionPreset>('balanced');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activePreset = COMPRESSION_PRESETS[preset];

  const reportProgress = useCallback(
    (current: number, total: number, label: string) => {
      const percent = total > 0 ? Math.round((current / total) * 100) : 0;
      onProcessingChange(true, label, percent);
    },
    [onProcessingChange]
  );

  const handleCompress = useCallback(async () => {
    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Analyzing PDF…', 0);

    try {
      const { bytes, downloadName, savingsLabel } = await compressPdfInBrowser(
        file,
        preset,
        ({ current, total, label }) => reportProgress(current, total, label)
      );

      triggerPdfDownload(bytes, downloadName, '_compressed');
      onProcessingChange(false, '', 0);
      onSuccess(`${activePreset.label} compression complete — ${savingsLabel}. Download started.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Compression failed.');
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [activePreset.label, file, onClose, onProcessingChange, onSuccess, preset, reportProgress]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="compress-pdf-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="compress-pdf-title" className="text-lg font-bold text-slate-900">
              Compress PDF
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
          Choose a preset. All processing runs locally in your browser — nothing is uploaded.
        </p>

        <div className="mt-3 space-y-2">
          {(Object.keys(COMPRESSION_PRESETS) as CompressionPreset[]).map((key) => {
            const item = COMPRESSION_PRESETS[key];
            const selected = preset === key;
            return (
              <label
                key={key}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition ${
                  selected
                    ? 'border-emerald-400 bg-emerald-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="compress-preset"
                  value={key}
                  checked={selected}
                  onChange={() => setPreset(key)}
                  disabled={busy}
                  className="mt-1 accent-emerald-600"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{item.label}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{item.description}</span>
                  {item.mode === 'jpeg' && (
                    <span className="mt-1 block text-[11px] text-slate-400">
                      JPEG {Math.round((item.quality ?? 0) * 100)}% · scale{' '}
                      {Math.round((item.scale ?? 1) * 100)}%
                    </span>
                  )}
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
            onClick={() => void handleCompress()}
            disabled={busy}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Compressing…' : 'Compress & download'}
          </button>
        </div>
      </div>
    </div>
  );
}
