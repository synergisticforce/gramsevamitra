import { useEffect, useState } from 'react';
import type { FileMetadata } from '../../shared/services/LocalVaultService';
import { localVaultService } from '../../shared/services/LocalVaultService';

export interface VaultImageViewerProps {
  file: FileMetadata;
  onClose: () => void;
}

export default function VaultImageViewer({ file, onClose }: VaultImageViewerProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const blob = await localVaultService.getFile(file.id);
        if (!blob) {
          throw new Error('This image could not be loaded from the vault.');
        }
        url = URL.createObjectURL(blob);
        if (!cancelled) setObjectUrl(url);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to open image.';
        if (!cancelled) setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-black/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vault-image-viewer-title"
    >
      <div className="mx-auto flex w-full max-w-3xl items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="vault-image-viewer-title"
            className="truncate text-sm font-semibold text-white"
          >
            {file.name}
          </h2>
          <p className="mt-0.5 text-xs font-medium text-slate-300">Saved offline in your Local Vault</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg border border-white/20 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-white/10"
          aria-label="Close image viewer"
        >
          Close
        </button>
      </div>

      <div className="mx-auto mt-4 flex min-h-0 w-full max-w-3xl flex-1 items-center justify-center">
        {loading && (
          <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <p className="text-sm font-medium text-slate-200">Opening image…</p>
          </div>
        )}
        {error && (
          <p className="rounded-xl border border-rose-400/40 bg-rose-950/50 px-4 py-3 text-sm text-rose-100" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && objectUrl && (
          <img
            src={objectUrl}
            alt={file.name}
            className="max-h-full max-w-full object-contain"
          />
        )}
      </div>
    </div>
  );
}
