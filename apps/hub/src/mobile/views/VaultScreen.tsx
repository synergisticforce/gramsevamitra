import { useCallback, useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  localVaultService,
  type FileMetadata,
} from '../../shared/services/LocalVaultService';
import FileCard from '../components/FileCard';
import VaultImageViewer from '../components/VaultImageViewer';

export interface VaultScreenProps {
  onBack?: () => void;
  highlightFileId?: string | null;
  highlightFileName?: string | null;
}

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

function isImageFile(file: FileMetadata): boolean {
  return file.mimeType.startsWith('image/');
}

export default function VaultScreen({
  onBack,
  highlightFileId = null,
  highlightFileName = null,
}: VaultScreenProps) {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<FileMetadata | null>(null);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});

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

  const imageFiles = useMemo(() => files.filter(isImageFile), [files]);

  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];

    const loadThumbs = async () => {
      const next: Record<string, string> = {};
      for (const file of imageFiles) {
        try {
          const blob = await localVaultService.getFile(file.id);
          if (!blob || cancelled) continue;
          const url = URL.createObjectURL(blob);
          created.push(url);
          next[file.id] = url;
        } catch {
          /* skip broken thumbnails */
        }
      }
      if (!cancelled) setThumbUrls(next);
    };

    void loadThumbs();

    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imageFiles]);

  useEffect(() => {
    if (!files.length) return;
    const match =
      files.find((file) => file.id === highlightFileId) ??
      files.find((file) => file.name === highlightFileName && isImageFile(file));
    if (match && isImageFile(match)) {
      setPreviewFile(match);
    }
  }, [files, highlightFileId, highlightFileName]);

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
      setPreviewFile((current) => (current?.id === id ? null : current));
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
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mb-2 inline-flex items-center rounded-lg border border-canvas-border px-3 py-1.5 text-xs font-semibold text-canvas-muted transition hover:bg-canvas-elevated"
          >
            ← Back to Image Studio
          </button>
        )}
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
        <>
          {imageFiles.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Photo gallery
              </h2>
              <ul className="grid grid-cols-3 gap-2">
                {imageFiles.map((file) => {
                  const highlighted =
                    file.id === highlightFileId || file.name === highlightFileName;
                  return (
                    <li key={`thumb-${file.id}`}>
                      <button
                        type="button"
                        onClick={() => setPreviewFile(file)}
                        className={`aspect-square w-full overflow-hidden rounded-xl border bg-canvas-elevated transition ${
                          highlighted
                            ? 'border-canvas-accent ring-2 ring-canvas-accent/50'
                            : 'border-canvas-border hover:border-canvas-accent'
                        }`}
                        aria-label={`View ${file.name}`}
                      >
                        {thumbUrls[file.id] ? (
                          <img
                            src={thumbUrls[file.id]}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full items-center justify-center text-xl" aria-hidden="true">
                            🖼️
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <ul className="grid grid-cols-1 gap-3" aria-busy={busyId !== null}>
            {files.map((file) => (
              <li key={file.id} className={busyId === file.id ? 'opacity-60' : undefined}>
                <FileCard file={file} onShare={handleShare} onDelete={handleDelete} />
              </li>
            ))}
          </ul>
        </>
      )}

      {previewFile && (
        <VaultImageViewer file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </section>
  );
}
