import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MediaCanvasAction } from '../../config/mediaCanvasActions';
import { actionsForImageMime, isImageMimeOrName } from '../../config/mediaCanvasActions';
import {
  clearMediaCanvasState,
  formatFileSize,
  loadMediaCanvasState,
  saveMediaCanvasState,
  type StoredFileMeta,
} from '../../lib/canvas/mediaCanvasStorage';
import { useMediaActionHandler } from '../../lib/canvas/useMediaActionHandler';
import CanvasProcessingOverlay from './CanvasProcessingOverlay';
import CanvasToast from './CanvasToast';
import ConvertFormatModal from './ConvertFormatModal';
import MediaActionToolbar from './MediaActionToolbar';
import MediaMagicDropzone from './MediaMagicDropzone';
import ResizeCompressModal from './ResizeCompressModal';

type CanvasPhase = 'empty' | 'active';
type MediaToolModal = 'resize-compress' | 'convert-format' | null;

interface ActiveFile {
  file: File | null;
  meta: StoredFileMeta;
  restoredFromSession: boolean;
}

interface ProcessingState {
  active: boolean;
  label: string;
  percent: number;
  subtitle?: string;
}

const PRO_MEDIA_SUBTITLE =
  'Pro GPU processing uses ephemeral Cloudflare R2 storage — deleted after transformation.';

export default function MediaLabCanvas() {
  const [phase, setPhase] = useState<CanvasPhase>('empty');
  const [activeFile, setActiveFile] = useState<ActiveFile | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [mediaModal, setMediaModal] = useState<MediaToolModal>(null);
  const [proMediaBusy, setProMediaBusy] = useState(false);
  const [processing, setProcessing] = useState<ProcessingState>({
    active: false,
    label: '',
    percent: 0,
  });

  const dismissToast = useCallback(() => setToastMessage(null), []);

  const requireCanvasFile = useCallback((): File | null => {
    if (!activeFile?.file) {
      setToastMessage('Re-upload your image on the canvas to run this action.');
      return null;
    }
    if (!isImageMimeOrName(activeFile.meta.type, activeFile.meta.name)) {
      setToastMessage('Media Lab accepts JPG, PNG, and WebP images only.');
      return null;
    }
    return activeFile.file;
  }, [activeFile]);

  const setProcessingProgress = useCallback(
    (active: boolean, label: string, percent: number, subtitle?: string) => {
      if (!active) {
        setProcessing({ active: false, label: '', percent: 0 });
        return;
      }
      setProcessing({ active: true, label, percent, subtitle });
    },
    []
  );

  const onProcessingChange = useCallback(
    (active: boolean, label: string, percent: number) => {
      setProcessingProgress(active, label, percent);
    },
    [setProcessingProgress]
  );

  const onProAction = useCallback(
    async (action: MediaCanvasAction) => {
      if (proMediaBusy) return;

      const file = requireCanvasFile();
      if (!file) return;

      const { resolveMediaProAction, runMediaProPipeline } = await import(
        '../../lib/canvas/mediaProProcess'
      );
      const apiAction = resolveMediaProAction(action.id);
      if (!apiAction) {
        setToastMessage(`${action.label} is coming soon.`);
        return;
      }

      setProMediaBusy(true);
      setProcessingProgress(
        true,
        'Uploading image to secure transient storage…',
        5,
        PRO_MEDIA_SUBTITLE
      );

      try {
        const result = await runMediaProPipeline(file, apiAction, ({ label, percent }) => {
          setProcessingProgress(true, label, percent, PRO_MEDIA_SUBTITLE);
        });
        setProcessingProgress(false, '', 0);
        const seconds =
          result.processingMs != null ? Math.round(result.processingMs / 1000) : 3;
        const actionLabel =
          apiAction === 'remove-bg' ? 'Background removal' : '4× upscale';
        setToastMessage(
          `${actionLabel} complete — ${result.fileName} downloaded (${seconds}s mock GPU pipeline).`
        );
      } catch (err) {
        setProcessingProgress(false, '', 0);
        setToastMessage(
          err instanceof Error ? err.message : 'Pro media processing failed. Please try again.'
        );
      } finally {
        setProMediaBusy(false);
      }
    },
    [proMediaBusy, requireCanvasFile, setProcessingProgress]
  );

  const onFreeAction = useCallback(
    (action: MediaCanvasAction) => {
      if (action.id === 'resize-compress') {
        if (!requireCanvasFile()) return;
        setMediaModal('resize-compress');
        return;
      }
      if (action.id === 'convert-format') {
        if (!requireCanvasFile()) return;
        setMediaModal('convert-format');
        return;
      }
      setToastMessage(`${action.label} is coming soon.`);
    },
    [requireCanvasFile]
  );

  const { handleActionClick } = useMediaActionHandler({ onFreeAction, onProAction });

  useEffect(() => {
    const stored = loadMediaCanvasState();
    if (stored) {
      setActiveFile({
        file: null,
        meta: stored.file,
        restoredFromSession: true,
      });
      setPhase('active');
    }
    setHydrated(true);
  }, []);

  const activateFile = useCallback((file: File) => {
    if (!isImageMimeOrName(file.type, file.name)) {
      setToastMessage('Please upload a JPG, PNG, or WebP image.');
      return;
    }
    saveMediaCanvasState(file);
    setActiveFile({
      file,
      meta: {
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        lastModified: file.lastModified,
      },
      restoredFromSession: false,
    });
    setPhase('active');
  }, []);

  const clearCanvas = useCallback(() => {
    clearMediaCanvasState();
    setActiveFile(null);
    setPhase('empty');
    setMediaModal(null);
  }, []);

  const replaceFile = useCallback(
    (file: File) => {
      activateFile(file);
    },
    [activateFile]
  );

  const toolbarActions = useMemo(() => {
    if (!activeFile) return [];
    return actionsForImageMime(activeFile.meta.type);
  }, [activeFile]);

  const canvasImageFile = activeFile?.file ?? null;

  if (!hydrated) {
    return (
      <div className="flex min-h-[280px] items-center justify-center px-4 py-12">
        <p className="text-sm text-slate-500">Loading canvas…</p>
      </div>
    );
  }

  return (
    <section className="px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">Workspace</p>
          <div className="mt-2 flex items-start gap-3">
            <span className="text-3xl" aria-hidden="true">
              🖼️
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Media Lab</h1>
              <p className="mt-1 text-sm text-slate-600">
                Resize, compress, convert, or AI-enhance — drop an image to begin.
              </p>
            </div>
          </div>
        </header>

        {phase === 'empty' && (
          <MediaMagicDropzone
            onFileSelect={activateFile}
            onInvalidFile={() => setToastMessage('Please upload a JPG, PNG, or WebP image.')}
          />
        )}

        {phase === 'active' && activeFile && (
          <div className="space-y-4">
            {activeFile.restoredFromSession && !activeFile.file && (
              <p
                className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                role="status"
              >
                Session restored after refresh. Your file metadata is preserved — re-upload below to run
                actions on a fresh copy.
              </p>
            )}

            <div className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-2xl"
                    aria-hidden="true"
                  >
                    🖼️
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-slate-900">{activeFile.meta.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatFileSize(activeFile.meta.size)}
                      {activeFile.meta.type ? ` · ${activeFile.meta.type}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                    Replace image
                    <input
                      type="file"
                      className="sr-only"
                      accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) replaceFile(file);
                        event.target.value = '';
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-800"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            <MediaActionToolbar actions={toolbarActions} onActionClick={handleActionClick} />
          </div>
        )}
      </div>

      {mediaModal === 'resize-compress' && canvasImageFile && (
        <ResizeCompressModal
          file={canvasImageFile}
          onClose={() => setMediaModal(null)}
          onSuccess={setToastMessage}
          onProcessingChange={onProcessingChange}
        />
      )}

      {mediaModal === 'convert-format' && canvasImageFile && (
        <ConvertFormatModal
          file={canvasImageFile}
          onClose={() => setMediaModal(null)}
          onSuccess={setToastMessage}
          onProcessingChange={onProcessingChange}
        />
      )}

      {processing.active && (
        <CanvasProcessingOverlay
          label={processing.label}
          percent={processing.percent}
          subtitle={processing.subtitle}
        />
      )}

      <CanvasToast message={toastMessage} onDismiss={dismissToast} />
    </section>
  );
}
