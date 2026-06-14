import { useCallback, useState } from 'react';
import { textToPdfInBrowser, triggerPdfDownload } from '../../lib/canvas/documentPdfTools';

interface Props {
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

export default function TypeSavePdfModal({ onClose, onSuccess, onProcessingChange }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reportProgress = useCallback(
    (current: number, total: number, label: string) => {
      const percent = total > 0 ? Math.round((current / total) * 100) : 0;
      onProcessingChange(true, label, percent);
    },
    [onProcessingChange]
  );

  const loadTextFile = useCallback(async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    try {
      setText(await file.text());
    } catch {
      setError('Could not read the text file.');
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!text.trim()) {
      setError('Type, paste, or upload some text first.');
      return;
    }

    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Creating PDF…', 0);

    try {
      const { bytes, downloadName } = await textToPdfInBrowser(text, ({ current, total, label }) =>
        reportProgress(current, total, label)
      );
      triggerPdfDownload(bytes, downloadName, '_typed');
      onProcessingChange(false, '', 0);
      onSuccess('PDF created from your text — download started.');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create PDF.');
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [onClose, onProcessingChange, onSuccess, reportProgress, text]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="type-save-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="type-save-title" className="text-lg font-bold text-slate-900">
              Type &amp; Save as PDF
            </h2>
            <p className="mt-1 text-sm text-slate-500">Create a formatted PDF from plain text</p>
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

        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Or load a .txt file
          </span>
          <input
            type="file"
            accept=".txt,text/plain"
            disabled={busy}
            onChange={(event) => {
              void loadTextFile(event.target.files);
              event.target.value = '';
            }}
            className="mt-1.5 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-emerald-800"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Your text
          </span>
          <textarea
            value={text}
            disabled={busy}
            onChange={(event) => {
              setText(event.target.value);
              setError(null);
            }}
            rows={10}
            placeholder="Type a declaration, address, notes, or paste content here…"
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none ring-emerald-500/30 focus:border-emerald-400 focus:ring-2 disabled:bg-slate-50"
          />
        </label>

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
            onClick={() => void handleSave()}
            disabled={busy || !text.trim()}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save as PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
