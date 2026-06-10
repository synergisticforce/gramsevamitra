import { useCallback, useState } from 'react';
import { ActionButton, FileDropZone, SelectedFileStatus, StatusMessage } from './ToolWorkspaceShell';
import { useToolProgress } from './ToolProgressContext';
import { downloadBytes } from '../../lib/pdfEngine';
import { runPdfWorkerWithStreamedFile } from '../../lib/pdfWorkerClient';

export default function UnlockPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { report, resetProgress } = useToolProgress();

  const unlock = useCallback(async () => {
    if (!file) {
      setError('Please select an encrypted PDF.');
      return;
    }
    if (!password) {
      setError('Enter the document password.');
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const out = await runPdfWorkerWithStreamedFile<Uint8Array>(
        'unlock-pdf',
        file,
        { password },
        ({ current, total, label }) => report(current, total, label)
      );
      downloadBytes(out, file.name, 'application/pdf', '_unlocked');
      setSuccess('PDF decrypted — password protection removed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unlock failed. Check the password.');
    } finally {
      resetProgress();
      setBusy(false);
    }
  }, [file, password, report, resetProgress]);

  return (
    <div className="space-y-4">
      <FileDropZone accept="application/pdf" label="Select password-protected PDF" onFiles={(f) => setFile(f[0] ?? null)} />
      <SelectedFileStatus file={file} />

      <label className="block">
        <span className="label text-emerald-200">Document password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input-field border-emerald-800/60 bg-[#064e3b]/20 focus:border-emerald-400"
          placeholder="Enter PDF open password"
          autoComplete="off"
        />
      </label>

      <p className="text-xs text-slate-500">
        Processing runs locally in your browser. Your password is never uploaded to any server.
      </p>

      <ActionButton onClick={unlock} disabled={busy || !file}>
        {busy ? 'Unlocking…' : 'Unlock & Download'}
      </ActionButton>
      <StatusMessage error={error} success={success} />
    </div>
  );
}
