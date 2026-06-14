import { useCallback, useMemo, useState } from 'react';
import { formatFileSize } from '../../lib/canvas/documentCanvasStorage';
import { protectPdfInBrowser, triggerPdfDownload } from '../../lib/canvas/documentPdfTools';
import { scorePasswordStrength } from '../../lib/pdf/passwordStrength';

interface Props {
  file: File;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

export default function ProtectPdfModal({ file, onClose, onSuccess, onProcessingChange }: Props) {
  const [userPassword, setUserPassword] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = useMemo(() => scorePasswordStrength(userPassword), [userPassword]);

  const reportProgress = useCallback(
    (current: number, total: number, label: string) => {
      const percent = total > 0 ? Math.round((current / total) * 100) : 0;
      onProcessingChange(true, label, percent);
    },
    [onProcessingChange]
  );

  const handleProtect = useCallback(async () => {
    if (!userPassword) {
      setError('Enter a user password to open the file.');
      return;
    }
    if (userPassword.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }

    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Encrypting PDF…', 0);

    try {
      const { bytes, downloadName } = await protectPdfInBrowser(
        file,
        {
          userPassword,
          ownerPassword: ownerPassword.trim() || undefined,
        },
        ({ current, total, label }) => reportProgress(current, total, label)
      );

      triggerPdfDownload(bytes, downloadName, '_protected');
      onProcessingChange(false, '', 0);
      onSuccess('PDF encrypted with AES protection. Download started — store your passwords safely.');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Protection failed.');
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [
    file,
    onClose,
    onProcessingChange,
    onSuccess,
    ownerPassword,
    reportProgress,
    userPassword,
  ]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="protect-pdf-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="protect-pdf-title" className="text-lg font-bold text-slate-900">
              Protect PDF
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
          AES encryption runs entirely on your device. Passwords are never sent to a server.
        </p>

        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            User password (required to open)
          </span>
          <input
            type="password"
            value={userPassword}
            onChange={(event) => {
              setUserPassword(event.target.value);
              setError(null);
            }}
            autoComplete="new-password"
            placeholder="Choose a strong open password"
            disabled={busy}
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none ring-emerald-500/30 focus:border-emerald-400 focus:ring-2 disabled:bg-slate-50"
          />
        </label>

        {userPassword.length > 0 && (
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Password strength</span>
              <span className={`font-semibold ${strength.textClass}`}>{strength.label}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all ${strength.barClass}`}
                style={{ width: `${strength.score}%` }}
              />
            </div>
          </div>
        )}

        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Owner password (optional)
          </span>
          <input
            type="password"
            value={ownerPassword}
            onChange={(event) => setOwnerPassword(event.target.value)}
            autoComplete="new-password"
            placeholder="Defaults to user password if empty"
            disabled={busy}
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
            onClick={() => void handleProtect()}
            disabled={busy}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Encrypting…' : 'Protect & download'}
          </button>
        </div>
      </div>
    </div>
  );
}
