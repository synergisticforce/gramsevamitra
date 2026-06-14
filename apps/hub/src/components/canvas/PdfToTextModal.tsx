import { useCallback, useEffect, useState } from 'react';
import {
  extractPdfTextInBrowser,
  splitFilenameBase,
  triggerTextDownload,
} from '../../lib/canvas/documentPdfTools';

interface Props {
  file: File;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

export default function PdfToTextModal({ file, onClose, onSuccess, onProcessingChange }: Props) {
  const [text, setText] = useState('');
  const [pageCount, setPageCount] = useState(0);
  const [busy, setBusy] = useState(true);
  const [copyBusy, setCopyBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setBusy(true);
      setError(null);
      setText('');
      onProcessingChange(true, 'Extracting text…', 0);

      try {
        const result = await extractPdfTextInBrowser(file, ({ current, total, label }) => {
          const percent = total > 0 ? Math.round((current / total) * 100) : 0;
          onProcessingChange(true, label, percent);
        });
        if (cancelled) return;
        setText(result.text);
        setPageCount(result.pageCount);
        onProcessingChange(false, '', 0);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Text extraction failed.');
        onProcessingChange(false, '', 0);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file, onProcessingChange]);

  const handleCopy = useCallback(async () => {
    if (!text) return;
    setCopyBusy(true);
    try {
      await navigator.clipboard.writeText(text);
      onSuccess('Text copied to clipboard.');
    } catch {
      setError('Could not copy to clipboard. Try downloading as .txt instead.');
    } finally {
      setCopyBusy(false);
    }
  }, [onSuccess, text]);

  const handleDownload = useCallback(() => {
    if (!text) return;
    const baseName = splitFilenameBase(file.name);
    triggerTextDownload(text, `${baseName}.txt`);
    onSuccess('Text file download started.');
  }, [file.name, onSuccess, text]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-to-text-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="pdf-to-text-title" className="text-lg font-bold text-slate-900">
              PDF to Text
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

        {busy ? (
          <p className="mt-4 text-sm text-slate-500">Extracting text from your PDF…</p>
        ) : error ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        ) : (
          <>
            <p className="mt-4 text-sm text-slate-600">
              Extracted text from{' '}
              <span className="font-semibold text-slate-900">{pageCount}</span> page
              {pageCount === 1 ? '' : 's'}. Copy or download instantly — nothing leaves your device.
            </p>
            <textarea
              readOnly
              value={text}
              rows={12}
              className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-xs text-slate-800 outline-none"
            />
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => void handleCopy()}
                disabled={!text || copyBusy}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {copyBusy ? 'Copying…' : 'Copy to clipboard'}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={!text}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Download .txt
              </button>
            </div>
          </>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
