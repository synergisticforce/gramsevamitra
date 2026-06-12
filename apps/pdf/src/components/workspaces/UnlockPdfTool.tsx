import { useCallback, useState } from 'react';
import { ActionButton, FileDropZone, SelectedFileStatus, StatusMessage } from './ToolWorkspaceShell';
import { useToolProgress } from './ToolProgressContext';
import { downloadBytes } from '../../lib/pdfEngine';
import { isPdfEncrypted } from '../../lib/pdfMetadata';
import { toProcessingError } from '../../lib/processingErrors';
import { runPdfWorkerWithStreamedFile } from '../../lib/pdfWorkerClient';

export default function UnlockPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [encrypted, setEncrypted] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { report, resetProgress } = useToolProgress();

  const handleFile = useCallback(async (files: File[]) => {
    const selected = files[0] ?? null;
    setFile(selected);
    setPassword('');
    setError(null);
    setSuccess(null);
    setEncrypted(null);

    if (!selected) return;

    setScanning(true);
    try {
      const needsPassword = await isPdfEncrypted(selected);
      setEncrypted(needsPassword);
      if (!needsPassword) {
        setError('This PDF does not appear to be password-protected. You can still try unlocking if it uses owner restrictions.');
      }
    } catch (err) {
      setError(toProcessingError(err));
      setEncrypted(null);
    } finally {
      setScanning(false);
    }
  }, []);

  const unlock = useCallback(async () => {
    if (!file) {
      setError('Please select an encrypted PDF.');
      return;
    }
    if (!password) {
      setError('Enter the document password to decrypt this file.');
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
      setSuccess('Password removed — clean PDF saved without encryption.');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.includes('password')
            ? 'Incorrect password. Please verify and try again.'
            : err.message
          : 'Unlock failed. Check the password and try again.'
      );
    } finally {
      resetProgress();
      setBusy(false);
    }
  }, [file, password, report, resetProgress]);

  return (
    <div className="space-y-4">
      <FileDropZone
        accept="application/pdf"
        label="Select password-protected PDF"
        onFiles={handleFile}
      />
      <SelectedFileStatus file={file} />

      {scanning && (
        <p className="text-sm text-emerald-200" role="status">
          Checking whether this PDF is encrypted…
        </p>
      )}

      {file && encrypted === true && (
        <div
          role="status"
          className="rounded-xl border border-amber-500/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100"
        >
          Password required — this document is encrypted. Enter the open password below to remove protection.
        </div>
      )}

      {file && encrypted === false && (
        <div
          role="status"
          className="rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3 text-sm text-slate-300"
        >
          No open-password lock detected. If the file still has owner restrictions, enter the owner password to
          produce a clean copy.
        </div>
      )}

      <label className="block">
        <span className="label text-emerald-200">Document password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
            setSuccess(null);
          }}
          className="input-field border-emerald-800/60 bg-[#064e3b]/20 focus:border-emerald-400"
          placeholder="Enter PDF open password"
          autoComplete="off"
        />
      </label>

      <p className="text-xs text-slate-500">
        Decryption runs locally in your browser. Your password is never uploaded to any server.
      </p>

      <ActionButton onClick={unlock} disabled={busy || !file || !password}>
        {busy ? 'Unlocking…' : 'Unlock & Download'}
      </ActionButton>
      <StatusMessage error={error} success={success} />
    </div>
  );
}
