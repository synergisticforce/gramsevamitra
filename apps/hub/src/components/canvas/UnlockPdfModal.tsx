import { useCallback, useEffect, useState } from 'react';
import { formatFileSize } from '../../lib/canvas/documentCanvasStorage';
import { triggerPdfDownload, unlockPdfInBrowser } from '../../lib/canvas/documentPdfTools';
import { requiresChunkedPipeline } from '../../lib/pdf/fileUploadLimits';
import { runChunkedUnlockPipeline } from '../../lib/upload/chunkedPipeline';
import { isPdfEncrypted } from '../../lib/pdf/pdfEncryption';

interface Props {
  file: File;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

export default function UnlockPdfModal({
  file,
  onClose,
  onSuccess,
  onError,
  onProcessingChange,
}: Props) {
  const [password, setPassword] = useState('');
  const [encrypted, setEncrypted] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setScanning(true);
      setError(null);
      try {
        const needsPassword = await isPdfEncrypted(file);
        if (cancelled) return;
        setEncrypted(needsPassword);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not read this PDF.');
      } finally {
        if (!cancelled) setScanning(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file]);

  const reportProgress = useCallback(
    (current: number, total: number, label: string) => {
      const percent = total > 0 ? Math.round((current / total) * 100) : 0;
      onProcessingChange(true, label, percent);
    },
    [onProcessingChange]
  );

  const handleUnlock = useCallback(async () => {
    if (!password) {
      const msg = 'Enter the document password to decrypt this file.';
      setError(msg);
      onError(msg);
      return;
    }

    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Decrypting PDF…', 0);

    try {
      if (requiresChunkedPipeline(file)) {
        await runChunkedUnlockPipeline(file, password, ({ label, percent }) =>
          onProcessingChange(true, label, percent),
        );
        onProcessingChange(false, '', 0);
        onSuccess('Password removed via Smart Slicing — clean PDF saved. Download started.');
        onClose();
        return;
      }

      const { bytes, downloadName } = await unlockPdfInBrowser(
        file,
        password,
        ({ current, total, label }) => reportProgress(current, total, label)
      );

      triggerPdfDownload(bytes, downloadName, '_unlocked');
      onProcessingChange(false, '', 0);
      onSuccess('Password removed — clean PDF saved without encryption. Download started.');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unlock failed. Check the password and try again.';
      setError(msg);
      onError(msg);
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [
    file,
    onClose,
    onError,
    onProcessingChange,
    onSuccess,
    password,
    reportProgress,
  ]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unlock-pdf-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="unlock-pdf-title" className="text-lg font-bold text-canvas-text">
              Unlock PDF
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

        {scanning ? (
          <p className="mt-4 text-sm font-medium leading-relaxed text-slate-200">Checking whether this PDF is encrypted…</p>
        ) : (
          <>
            {encrypted === true && (
              <p
                className="mt-4 rounded-xl border border-canvas-border bg-canvas-elevated px-3 py-2.5 text-sm text-slate-200"
                role="status"
              >
                This document is password-protected. Enter the open password to remove encryption.
              </p>
            )}
            {encrypted === false && (
              <p
                className="mt-4 rounded-xl border border-canvas-border bg-canvas-elevated px-3 py-2.5 text-sm font-medium leading-relaxed text-slate-200"
                role="status"
              >
                No open-password lock detected. If the file has owner restrictions, enter the owner
                password to produce a clean copy.
              </p>
            )}

            <label className="mt-4 block">
              <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
                Document password
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError(null);
                }}
                autoComplete="off"
                placeholder="Enter PDF open password"
                disabled={busy}
                className="mt-1.5 w-full rounded-xl border border-canvas-border px-3 py-2.5 text-sm text-canvas-text outline-none ring-canvas-accent/50/30 focus:border-canvas-accent focus:ring-2 disabled:bg-canvas-elevated"
              />
            </label>

            <p className="mt-2 text-xs font-medium leading-relaxed text-slate-300">
              Decryption runs locally in your browser. Your password is never uploaded.
            </p>
          </>
        )}

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
            onClick={() => void handleUnlock()}
            disabled={busy || scanning || !password}
            className="rounded-xl bg-canvas-accent-muted px-4 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Unlocking…' : 'Unlock & download'}
          </button>
        </div>
      </div>
    </div>
  );
}
