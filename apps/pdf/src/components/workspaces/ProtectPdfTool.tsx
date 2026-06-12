import { useCallback, useMemo, useState } from 'react';
import { ActionButton, FileDropZone, SelectedFileStatus, StatusMessage } from './ToolWorkspaceShell';
import { useToolProgress } from './ToolProgressContext';
import { downloadBytes } from '../../lib/pdfEngine';
import { scorePasswordStrength } from '../../lib/pdfMetadata';
import { runPdfWorkerWithStreamedFile } from '../../lib/pdfWorkerClient';

export default function ProtectPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [userPassword, setUserPassword] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [disablePrinting, setDisablePrinting] = useState(false);
  const [disableCopying, setDisableCopying] = useState(true);
  const [disableModifying, setDisableModifying] = useState(true);
  const [disableAnnotating, setDisableAnnotating] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { report, resetProgress } = useToolProgress();

  const strength = useMemo(() => scorePasswordStrength(userPassword), [userPassword]);

  const protect = useCallback(async () => {
    if (!file) {
      setError('Please select a PDF.');
      return;
    }
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
    setSuccess(null);

    try {
      const out = await runPdfWorkerWithStreamedFile<Uint8Array>(
        'protect-pdf',
        file,
        {
          userPassword,
          ownerPassword: ownerPassword || userPassword,
          restrictions: {
            disablePrinting,
            disableCopying,
            disableModifying,
            disableAnnotating,
          },
        },
        ({ current, total, label }) => report(current, total, label)
      );
      downloadBytes(out, file.name, 'application/pdf', '_protected');
      setSuccess('PDF encrypted with AES protection. Store your passwords safely.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Protection failed.');
    } finally {
      resetProgress();
      setBusy(false);
    }
  }, [
    file,
    userPassword,
    ownerPassword,
    disablePrinting,
    disableCopying,
    disableModifying,
    disableAnnotating,
    report,
    resetProgress,
  ]);

  return (
    <div className="space-y-4">
      <FileDropZone
        accept="application/pdf"
        label="Select PDF to protect with a password"
        onFiles={(f) => {
          setFile(f[0] ?? null);
          setError(null);
          setSuccess(null);
        }}
      />
      <SelectedFileStatus file={file} />

      <label className="block">
        <span className="label text-emerald-200">User password (required to open the file)</span>
        <input
          type="password"
          value={userPassword}
          onChange={(e) => {
            setUserPassword(e.target.value);
            setError(null);
            setSuccess(null);
          }}
          className="input-field border-emerald-800/60 bg-[#064e3b]/20 focus:border-emerald-400"
          autoComplete="new-password"
          placeholder="Choose a strong open password"
        />
      </label>

      {userPassword.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Password strength</span>
            <span className={`font-semibold ${strength.textClass}`}>{strength.label}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full transition-all ${strength.barClass}`}
              style={{ width: `${strength.score}%` }}
            />
          </div>
        </div>
      )}

      <label className="block">
        <span className="label text-emerald-200">Owner password (optional — controls permissions)</span>
        <input
          type="password"
          value={ownerPassword}
          onChange={(e) => setOwnerPassword(e.target.value)}
          className="input-field border-emerald-800/60 bg-[#064e3b]/20 focus:border-emerald-400"
          placeholder="Defaults to user password if empty"
          autoComplete="new-password"
        />
      </label>

      <fieldset className="space-y-2 rounded-xl border border-slate-700 bg-slate-900/50 p-4">
        <legend className="px-1 text-sm font-semibold text-white">Document permissions</legend>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={disablePrinting}
            onChange={(e) => setDisablePrinting(e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 accent-emerald-500"
          />
          Disable printing
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={disableCopying}
            onChange={(e) => setDisableCopying(e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 accent-emerald-500"
          />
          Disable copying text &amp; images
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={disableModifying}
            onChange={(e) => setDisableModifying(e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 accent-emerald-500"
          />
          Disable editing
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={disableAnnotating}
            onChange={(e) => setDisableAnnotating(e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 accent-emerald-500"
          />
          Disable annotations &amp; comments
        </label>
      </fieldset>

      <p className="text-xs text-slate-500">
        AES encryption runs entirely on your device. Passwords are never uploaded to any server.
      </p>

      <ActionButton onClick={protect} disabled={busy || !file}>
        {busy ? 'Encrypting…' : 'Protect & Download'}
      </ActionButton>
      <StatusMessage error={error} success={success} />
    </div>
  );
}
