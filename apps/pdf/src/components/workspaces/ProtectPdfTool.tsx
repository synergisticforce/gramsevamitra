import { useCallback, useState } from 'react';
import { ActionButton, FileDropZone, SelectedFileStatus, StatusMessage } from './ToolWorkspaceShell';
import { useToolProgress } from './ToolProgressContext';
import { downloadBytes } from '../../lib/pdfEngine';
import { runPdfWorkerWithStreamedFile } from '../../lib/pdfWorkerClient';

export default function ProtectPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [userPassword, setUserPassword] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { report, resetProgress } = useToolProgress();

  const protect = useCallback(async () => {
    if (!file) {
      setError('Please select a PDF.');
      return;
    }
    if (!userPassword) {
      setError('Enter a user password to open the file.');
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const out = await runPdfWorkerWithStreamedFile<Uint8Array>(
        'protect-pdf',
        file,
        { userPassword, ownerPassword: ownerPassword || userPassword },
        ({ current, total, label }) => report(current, total, label)
      );
      downloadBytes(out, file.name, 'application/pdf', '_protected');
      setSuccess('PDF encrypted with password protection.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Protection failed.');
    } finally {
      resetProgress();
      setBusy(false);
    }
  }, [file, userPassword, ownerPassword, report, resetProgress]);

  return (
    <div className="space-y-4">
      <FileDropZone accept="application/pdf" label="Select PDF to protect" onFiles={(f) => setFile(f[0] ?? null)} />
      <SelectedFileStatus file={file} />

      <label className="block">
        <span className="label text-emerald-200">User password (required to open the file)</span>
        <input
          type="password"
          value={userPassword}
          onChange={(e) => setUserPassword(e.target.value)}
          className="input-field border-emerald-800/60 bg-[#064e3b]/20 focus:border-emerald-400"
          autoComplete="new-password"
          placeholder="Blocks reading without this password"
        />
      </label>

      <label className="block">
        <span className="label text-emerald-200">Owner password (blocks metadata &amp; permission changes)</span>
        <input
          type="password"
          value={ownerPassword}
          onChange={(e) => setOwnerPassword(e.target.value)}
          className="input-field border-emerald-800/60 bg-[#064e3b]/20 focus:border-emerald-400"
          placeholder="Defaults to user password if empty"
          autoComplete="new-password"
        />
      </label>

      <p className="text-xs text-slate-500">
        AES encryption is applied on your device before download. Printing is allowed at high resolution;
        copying, editing, and form filling are disabled. Store your passwords safely — they are never
        uploaded.
      </p>

      <ActionButton onClick={protect} disabled={busy || !file}>
        {busy ? 'Encrypting…' : 'Protect & Download'}
      </ActionButton>
      <StatusMessage error={error} success={success} />
    </div>
  );
}
