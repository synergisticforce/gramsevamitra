import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import DocumentCameraScanner from '../../components/canvas/DocumentCameraScanner';
import {
  localVaultService,
  type FileMetadata,
} from '../../shared/services/LocalVaultService';
import { makeScanFileName } from '../../shared/lib/scanFileName';
import FileCard from '../components/FileCard';
import VaultImageViewer from '../components/VaultImageViewer';
import MobileToolSheet from '../components/MobileToolSheet';

interface PendingCapture {
  file: File;
  previewUrl: string;
}

/** Android pickers and ML Kit often report an empty MIME type — fall back to the name. */
function resolveCaptureMime(file: File): string {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.heic') || name.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

function formatListDate(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}

function isImageFile(file: FileMetadata): boolean {
  return file.mimeType.startsWith('image/');
}

function isPdfFile(file: FileMetadata): boolean {
  return file.mimeType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

export default function ScanHomeScreen() {
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pending, setPending] = useState<PendingCapture[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [viewing, setViewing] = useState<FileMetadata | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toolTarget, setToolTarget] = useState<{ file: File; name: string } | null>(null);
  const [processing, setProcessing] = useState<{ label: string; percent: number } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await localVaultService.listFiles();
      setFiles(items);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load saved files.';
      console.warn('[ScanHomeScreen] listFiles failed:', message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(null), 6000);
    return () => window.clearTimeout(timer);
  }, [success]);

  const clearPending = useCallback(() => {
    setPending((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
    setPreviewIndex(0);
  }, []);

  const pendingUrlsRef = useRef<string[]>([]);
  const pdfUrlRef = useRef<string | null>(null);

  useEffect(() => {
    pendingUrlsRef.current = pending.map((item) => item.previewUrl);
  }, [pending]);

  useEffect(() => {
    pdfUrlRef.current = pdfPreviewUrl;
  }, [pdfPreviewUrl]);

  useEffect(() => {
    return () => {
      pendingUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    };
  }, []);

  /** Queue every captured page — a multi-page scan must never drop pages. */
  const queueCaptures = useCallback((incoming: File[]) => {
    const next = incoming.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    if (next.length === 0) return;
    setPending((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return next;
    });
    setPreviewIndex(0);
    setError(null);
  }, []);

  const handleFilesCaptured = useCallback(
    (captured: File[]) => {
      if (captured.length === 0) {
        setError('No page was captured. Please try again.');
        return;
      }
      queueCaptures(captured);
    },
    [queueCaptures],
  );

  const handleGalleryChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const picked = Array.from(event.target.files ?? []);
      event.target.value = '';
      if (picked.length === 0) return;
      queueCaptures(picked);
    },
    [queueCaptures],
  );

  const handleSave = useCallback(async () => {
    if (pending.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    try {
      for (let index = 0; index < pending.length; index += 1) {
        const item = pending[index];
        const mimeType = resolveCaptureMime(item.file);
        const fileName = makeScanFileName(mimeType, index);
        await localVaultService.saveFile(item.file, fileName, mimeType);
      }
      clearPending();
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save this document offline.';
      console.warn('[ScanHomeScreen] save failed:', message);
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [clearPending, pending, refresh, saving]);

  /** Combine the captured pages into a single searchable-ready PDF document. */
  const handleSaveAsPdf = useCallback(async () => {
    if (pending.length === 0 || saving) return;
    const images = pending.filter((item) => resolveCaptureMime(item.file).startsWith('image/'));
    if (images.length === 0) {
      setError('Only photo pages can be combined into a PDF.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { imagesToPdfInBrowser } = await import('../../lib/canvas/documentPdfTools');
      const { bytes } = await imagesToPdfInBrowser(images.map((item) => item.file));
      const fileName = makeScanFileName('application/pdf');
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
      await localVaultService.saveFile(blob, fileName, 'application/pdf');
      clearPending();
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not build the PDF.';
      console.warn('[ScanHomeScreen] PDF save failed:', message);
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [clearPending, pending, refresh, saving]);

  const handleDelete = useCallback(async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await localVaultService.deleteFile(id);
      setFiles((current) => current.filter((item) => item.id !== id));
      setViewing((current) => (current?.id === id ? null : current));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed.';
      console.warn('[ScanHomeScreen] delete failed:', message);
      setError(message);
    } finally {
      setBusyId(null);
    }
  }, []);

  const handleOpen = useCallback(async (file: FileMetadata) => {
    setError(null);
    if (isImageFile(file)) {
      setPdfPreviewUrl((url) => {
        if (url) URL.revokeObjectURL(url);
        return null;
      });
      setViewing(file);
      return;
    }

    if (isPdfFile(file)) {
      try {
        const blob = await localVaultService.getFile(file.id);
        if (!blob) throw new Error('This file could not be loaded from local storage.');
        const url = URL.createObjectURL(blob);
        setPdfPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setViewing(file);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to open this file.';
        setError(message);
      }
      return;
    }

    setError('Preview is available for images and PDFs. Other file types stay saved offline.');
  }, []);

  /** Load a saved document back into memory so the offline tools can act on it. */
  const handleTools = useCallback(async (meta: FileMetadata) => {
    setError(null);
    setBusyId(meta.id);
    try {
      const blob = await localVaultService.getFile(meta.id);
      if (!blob) throw new Error('This file could not be loaded from local storage.');
      const file = new File([blob], meta.name, {
        type: meta.mimeType || blob.type || 'application/octet-stream',
        lastModified: meta.created,
      });
      setToolTarget({ file, name: meta.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open tools for this file.');
    } finally {
      setBusyId(null);
    }
  }, []);

  const handleShare = useCallback(async (meta: FileMetadata) => {
    setError(null);
    setBusyId(meta.id);
    try {
      const blob = await localVaultService.getFile(meta.id);
      if (!blob) throw new Error('This file could not be loaded from local storage.');
      const { deliverFile } = await import('@shared/utils/fileDelivery');
      await deliverFile(blob, meta.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to share this file.');
    } finally {
      setBusyId(null);
    }
  }, []);

  const onToolProcessingChange = useCallback(
    (active: boolean, label: string, percent: number) => {
      setProcessing(active ? { label, percent } : null);
    },
    [],
  );

  const closeViewer = useCallback(() => {
    setViewing(null);
    setPdfPreviewUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
  }, []);

  const emptyHint = useMemo(
    () =>
      'Scan a paper or pick a photo from your gallery. Files stay on this phone — no internet needed.',
    [],
  );

  const activePending = pending[previewIndex] ?? pending[0] ?? null;
  const hasImagePages = pending.some((item) => resolveCaptureMime(item.file).startsWith('image/'));

  return (
    <section className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-5 sm:px-5">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-canvas-subtle">
          GramsevaMitra
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-canvas-text">Your documents</h1>
        <p className="text-sm font-medium leading-relaxed text-slate-300">
          Scan, save, and reopen papers offline — built for field work on a phone.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setCameraOpen(true)}
          className="inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-canvas-accent-muted px-6 py-4 text-lg font-bold text-canvas-text transition hover:bg-canvas-accent/40 active:scale-[0.98]"
        >
          Scan Document
        </button>
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-canvas-border bg-canvas-elevated px-6 py-3.5 text-base font-semibold text-canvas-text transition hover:bg-canvas-surface active:scale-[0.98]"
        >
          Choose from Gallery
        </button>
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={handleGalleryChange}
        />
      </div>

      {error && (
        <p
          className="rounded-xl border border-canvas-border bg-canvas-danger-soft/30 px-4 py-3 text-sm font-medium leading-relaxed text-rose-200"
          role="alert"
        >
          {error}
        </p>
      )}

      {success && (
        <p
          className="rounded-xl border border-emerald-800/50 bg-emerald-950/40 px-4 py-3 text-sm font-medium leading-relaxed text-emerald-100"
          role="status"
        >
          {success}
        </p>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-canvas-text">Saved on this device</h2>
          <button
            type="button"
            onClick={() => void refresh()}
            className="min-h-10 rounded-xl px-3 text-xs font-semibold text-slate-300 transition hover:bg-canvas-elevated hover:text-canvas-text"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div
            className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-2xl border border-canvas-border bg-canvas-surface px-4 py-10"
            role="status"
            aria-live="polite"
          >
            <div
              className="h-9 w-9 animate-spin rounded-full border-2 border-canvas-border border-t-canvas-accent"
              aria-hidden="true"
            />
            <p className="text-sm font-semibold text-canvas-text">Loading files…</p>
          </div>
        ) : files.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-canvas-border bg-canvas-surface px-5 py-10 text-center">
            <p className="text-base font-semibold text-canvas-text">No saved documents yet</p>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-300">{emptyHint}</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3" aria-busy={busyId !== null}>
            {files.map((file) => (
              <li key={file.id} className={busyId === file.id ? 'opacity-60' : undefined}>
                <FileCard
                  file={file}
                  subtitle={formatListDate(file.created)}
                  onOpen={handleOpen}
                  onTools={(meta) => void handleTools(meta)}
                  onShare={(meta) => void handleShare(meta)}
                  onDelete={handleDelete}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {activePending && (
        <div
          className="fixed inset-0 z-[70] flex flex-col bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="scan-preview-title"
        >
          <div className="mx-auto flex w-full max-w-lg items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="scan-preview-title" className="text-base font-bold text-white">
                {pending.length > 1
                  ? `Preview page ${previewIndex + 1} of ${pending.length}`
                  : 'Preview capture'}
              </h2>
              <p className="mt-1 text-xs font-medium text-slate-300">
                {pending.length > 1
                  ? 'Check each page, then save all of them offline on this phone.'
                  : 'Check the page, then save it offline on this phone.'}
              </p>
            </div>
            <button
              type="button"
              onClick={clearPending}
              disabled={saving}
              className="min-h-11 shrink-0 rounded-xl border border-white/20 px-4 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>

          <div className="mx-auto mt-4 flex min-h-0 w-full max-w-lg flex-1 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black">
            {resolveCaptureMime(activePending.file) === 'application/pdf' ? (
              <iframe
                title="PDF preview"
                src={activePending.previewUrl}
                className="h-full min-h-[50vh] w-full bg-white"
              />
            ) : (
              <img
                src={activePending.previewUrl}
                alt={`Captured document preview, page ${previewIndex + 1}`}
                className="max-h-full max-w-full object-contain"
              />
            )}
          </div>

          {pending.length > 1 && (
            <div className="mx-auto mt-3 flex w-full max-w-lg items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setPreviewIndex((index) => Math.max(0, index - 1))}
                disabled={saving || previewIndex === 0}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-white/20 px-4 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="shrink-0 text-xs font-semibold text-slate-300" aria-live="polite">
                {previewIndex + 1} / {pending.length}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPreviewIndex((index) => Math.min(pending.length - 1, index + 1))
                }
                disabled={saving || previewIndex >= pending.length - 1}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-white/20 px-4 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}

          <div className="mx-auto mt-4 flex w-full max-w-lg flex-col gap-2">
            {hasImagePages && (
              <button
                type="button"
                onClick={() => void handleSaveAsPdf()}
                disabled={saving}
                className="inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-indigo-500 px-5 text-base font-bold text-white transition hover:bg-indigo-400 disabled:opacity-60"
              >
                {saving
                  ? 'Saving…'
                  : pending.length > 1
                    ? `Save as one PDF (${pending.length} pages)`
                    : 'Save as PDF'}
              </button>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={clearPending}
                disabled={saving}
                className="inline-flex min-h-12 flex-1 items-center justify-center rounded-2xl border border-white/25 px-5 text-base font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
              >
                Retake
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="inline-flex min-h-12 flex-1 items-center justify-center rounded-2xl border border-white/25 px-5 text-base font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
              >
                {saving
                  ? 'Saving…'
                  : pending.length > 1
                    ? `Keep ${pending.length} photos`
                    : 'Keep as photo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewing && isImageFile(viewing) && (
        <VaultImageViewer file={viewing} onClose={closeViewer} />
      )}

      {viewing && isPdfFile(viewing) && pdfPreviewUrl && (
        <div
          className="fixed inset-0 z-[80] flex flex-col bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vault-pdf-viewer-title"
        >
          <div className="mx-auto flex w-full max-w-3xl items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="vault-pdf-viewer-title"
                className="truncate text-sm font-semibold text-white"
              >
                {viewing.name}
              </h2>
              <p className="mt-0.5 text-xs font-medium text-slate-300">
                Saved offline in your Local Vault
              </p>
            </div>
            <button
              type="button"
              onClick={closeViewer}
              className="min-h-11 shrink-0 rounded-xl border border-white/20 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Close
            </button>
          </div>
          <iframe
            title={viewing.name}
            src={pdfPreviewUrl}
            className="mx-auto mt-4 h-full min-h-0 w-full max-w-3xl flex-1 rounded-2xl bg-white"
          />
        </div>
      )}

      {toolTarget && (
        <MobileToolSheet
          file={toolTarget.file}
          fileName={toolTarget.name}
          onClose={() => setToolTarget(null)}
          onSuccess={(message) => {
            setError(null);
            setToolTarget(null);
            setProcessing(null);
            setSuccess(message);
            void refresh();
          }}
          onError={(message) => setError(message)}
          onProcessingChange={onToolProcessingChange}
        />
      )}

      {processing && (
        <div
          className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-4 bg-black/80 px-6"
          role="status"
          aria-live="polite"
        >
          <div
            className="h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white"
            aria-hidden="true"
          />
          <p className="text-center text-base font-semibold text-white">{processing.label}</p>
          <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-300"
              style={{ width: `${Math.max(4, Math.min(100, processing.percent))}%` }}
            />
          </div>
        </div>
      )}

      <DocumentCameraScanner
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onFilesCaptured={handleFilesCaptured}
        onError={(message) => setError(message)}
      />
    </section>
  );
}
