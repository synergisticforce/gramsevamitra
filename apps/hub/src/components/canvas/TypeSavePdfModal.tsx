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
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="type-save-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="type-save-title" className="text-lg font-bold text-canvas-text">
              Type &amp; Save as PDF
            </h2>
            <p className="mt-1 text-sm font-medium leading-relaxed text-slate-200">Create a formatted PDF from plain text</p>
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

        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
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
            className="mt-1.5 block w-full text-sm font-medium leading-relaxed text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-canvas-accent-soft file:px-3 file:py-2 file:text-xs file:font-semibold file:text-canvas-accent"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
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
            className="mt-1.5 w-full rounded-xl border border-canvas-border px-3 py-2.5 text-sm text-canvas-text outline-none ring-canvas-accent/50/30 focus:border-canvas-accent focus:ring-2 disabled:bg-canvas-elevated"
          />
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
            className="rounded-xl border border-canvas-border px-4 py-2.5 text-sm font-semibold text-canvas-muted transition hover:bg-canvas-elevated disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={busy || !text.trim()}
            className="rounded-xl bg-canvas-accent-muted px-4 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save as PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
