import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  localVaultService,
  type FileMetadata,
} from '../../shared/services/LocalVaultService';
import FileCard from '../components/FileCard';

async function downloadBlob(blob: Blob, fileName: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function VaultScreen() {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await localVaultService.listFiles();
      setFiles(items);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load vault files.';
      console.warn('[VaultScreen] listFiles failed:', message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleShare = useCallback(async (file: FileMetadata) => {
    setBusyId(file.id);
    setError(null);

    try {
      if (Capacitor.isNativePlatform()) {
        const uri = await localVaultService.getFileUri(file.id);
        if (!uri) {
          throw new Error('Local file URI is unavailable for sharing.');
        }
        const { Share } = await import('@capacitor/share');
        await Share.share({
          title: file.name,
          url: uri,
          dialogTitle: `Share ${file.name}`,
        });
        return;
      }

      const blob = await localVaultService.getFile(file.id);
      if (!blob) {
        throw new Error('File data is missing from the local vault.');
      }

      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        const sharedFile = new File([blob], file.name, {
          type: file.mimeType || blob.type || 'application/octet-stream',
        });
        try {
          await navigator.share({
            title: file.name,
            files: [sharedFile],
          });
          return;
        } catch (shareErr) {
          if (shareErr instanceof DOMException && shareErr.name === 'AbortError') {
            return;
          }
          console.warn('[VaultScreen] navigator.share failed, falling back to download:', shareErr);
        }
      }

      await downloadBlob(blob, file.name);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Share failed.';
      console.warn('[VaultScreen] share failed:', message);
      setError(message);
    } finally {
      setBusyId(null);
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await localVaultService.deleteFile(id);
      setFiles((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed.';
      console.warn('[VaultScreen] delete failed:', message);
      setError(message);
    } finally {
      setBusyId(null);
    }
  }, []);

  return (
    <section className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-5 sm:px-5">
      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-canvas-subtle">
          Local Vault
        </p>
        <h1 className="text-xl font-bold text-canvas-text">Your offline files</h1>
        <p className="text-sm font-medium leading-relaxed text-slate-300">
          Documents, photos, and videos saved on this device — never uploaded to the cloud.
        </p>
      </header>

      {error && (
        <p
          className="rounded-xl border border-canvas-border bg-canvas-danger-soft/30 px-3 py-2 text-sm font-medium text-rose-200"
          role="alert"
        >
          {error}
        </p>
      )}

      {loading ? (
        <div
          className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border border-canvas-border bg-canvas-surface px-4 py-10"
          role="status"
          aria-live="polite"
        >
          <div
            className="h-9 w-9 animate-spin rounded-full border-2 border-canvas-border border-t-canvas-accent"
            aria-hidden="true"
          />
          <p className="text-sm font-semibold text-canvas-text">Loading vault…</p>
        </div>
      ) : files.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-canvas-border bg-canvas-surface px-5 py-10 text-center">
          <p className="text-base font-semibold text-canvas-text">Vault is empty</p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-300">
            Processed documents and media will appear here for offline access and one-tap sharing.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3" aria-busy={busyId !== null}>
          {files.map((file) => (
            <li key={file.id} className={busyId === file.id ? 'opacity-60' : undefined}>
              <FileCard file={file} onShare={handleShare} onDelete={handleDelete} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
