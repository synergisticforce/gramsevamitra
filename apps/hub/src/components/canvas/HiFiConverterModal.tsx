import { useCallback, useState } from 'react';
import {
  runFileConverterPipeline,
  type HiFiOutputFormat,
} from '../../lib/canvas/documentFileConverter';
import { useProCreditConfirm } from '../../lib/auth/useProCreditConfirm';

interface Props {
  file: File;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number, subtitle?: string) => void;
}

function pillClass(active: boolean): string {
  return `rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
    active
      ? 'border-violet-500 bg-violet-50 text-violet-800'
      : 'border-slate-200 text-slate-600 hover:border-violet-300'
  }`;
}

export default function HiFiConverterModal({
  file,
  onClose,
  onSuccess,
  onProcessingChange,
}: Props) {
  const [format, setFormat] = useState<HiFiOutputFormat>('docx');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { requestProConfirm, proCreditModal } = useProCreditConfirm();

  const proSubtitle =
    'Pro conversion uses ephemeral Cloudflare R2 storage — deleted after processing.';

  const handleConvert = useCallback(async () => {
    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Uploading PDF to secure transient storage…', 5, proSubtitle);

    try {
      const result = await runFileConverterPipeline(file, format, ({ label, percent }) => {
        onProcessingChange(true, label, percent, proSubtitle);
      });
      onProcessingChange(false, '', 0);
      const seconds =
        result.processingMs != null ? Math.round(result.processingMs / 1000) : 3;
      onSuccess(
        `Converted to ${result.format.toUpperCase()} — ${result.fileName} downloaded (${seconds}s mock pipeline).`
      );
      onClose();
    } catch (err) {
      onProcessingChange(false, '', 0);
      setError(err instanceof Error ? err.message : 'Conversion failed.');
    } finally {
      setBusy(false);
    }
  }, [file, format, onClose, onProcessingChange, onSuccess]);

  const handleConvertClick = useCallback(() => {
    void requestProConfirm('file-converter', 'High-Fidelity Converter', () => handleConvert());
  }, [handleConvert, requestProConfirm]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hifi-converter-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-violet-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">⚡ Pro</p>
            <h2 id="hifi-converter-title" className="text-lg font-bold text-slate-900">
              High-Fidelity Converter
            </h2>
            <p className="mt-1 text-xs text-slate-500 truncate">{file.name}</p>
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
          Convert your PDF to an editable Office document via our serverless pipeline. Your file is
          uploaded to secure transient storage and deleted after conversion.
        </p>

        <fieldset className="mt-4">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Output format
          </legend>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setFormat('docx')}
              className={pillClass(format === 'docx')}
            >
              Word (.docx)
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setFormat('pptx')}
              className={pillClass(format === 'pptx')}
            >
              PowerPoint (.pptx)
            </button>
          </div>
        </fieldset>

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
            onClick={handleConvertClick}
            disabled={busy}
            className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Converting…' : 'Review credits & convert'}
          </button>
        </div>
      </div>
      {proCreditModal}
    </div>
  );
}
