import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import type { OmniHandoffPayload } from '../../lib/omni/handoff';
import {
  resolveMediaOmniAction,
  resolveMediaOmniModal,
} from '../../lib/omni/omniDispatch';
import { useOmniWorkspaceHandoff } from '../../lib/omni/useOmniWorkspaceHandoff';
import { useProCreditConfirm } from '../../lib/auth/useProCreditConfirm';
import OmniHandoffLoading from '../omni/OmniHandoffLoading';
import CanvasProcessingOverlay from './CanvasProcessingOverlay';
import CanvasToast from './CanvasToast';
import ConvertFormatModal from './ConvertFormatModal';
import ExamPhotoOptimizerModal from './ExamPhotoOptimizerModal';
import MediaActionToolbar from './MediaActionToolbar';
import MediaMagicDropzone from './MediaMagicDropzone';
import ResizeCompressModal from './ResizeCompressModal';

type CanvasPhase = 'empty' | 'active';
type MediaToolModal = 'exam-photo-optimizer' | 'resize-compress' | 'convert-format' | null;

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
  'Pro processing uses secure temporary storage — deleted immediately after transformation.';

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
  const pendingOmniIntentRef = useRef<string | null>(null);
  const handleActionClickRef = useRef<(actionId: string) => void>(() => {});
  const { requestProConfirm, proCreditModal } = useProCreditConfirm();

  const dismissToast = useCallback(() => setToastMessage(null), []);

  const requireCanvasFile = useCallback((): File | null => {
    if (!activeFile?.file) {
      setToastMessage('Re-upload your image on the canvas to run this action.');
      return null;
    }
    if (!isImageMimeOrName(activeFile.meta.type, activeFile.meta.name)) {
      setToastMessage('Image Studio accepts JPG, PNG, and WebP images only.');
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

  const runMediaProJob = useCallback(
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
        PRO_MEDIA_SUBTITLE,
      );

      try {
        const result = await runMediaProPipeline(file, apiAction, ({ label, percent }) => {
          setProcessingProgress(true, label, percent, PRO_MEDIA_SUBTITLE);
        });
        setProcessingProgress(false, '', 0);
        const seconds =
          result.processingMs != null ? Math.round(result.processingMs / 1000) : 3;
        const actionLabel =
          apiAction === 'remove-bg'
            ? 'Background removal'
            : apiAction === 'restore'
              ? 'AI photo restoration'
              : '4× upscale';
        setToastMessage(
          `${actionLabel} complete — ${result.fileName} downloaded (${seconds}s mock GPU pipeline).`,
        );
      } catch (err) {
        setProcessingProgress(false, '', 0);
        setToastMessage(
          err instanceof Error ? err.message : 'Pro media processing failed. Please try again.',
        );
      } finally {
        setProMediaBusy(false);
      }
    },
    [proMediaBusy, requireCanvasFile, setProcessingProgress],
  );

  const onProAction = useCallback(
    async (action: MediaCanvasAction) => {
      if (proMediaBusy) return;
      if (!requireCanvasFile()) return;
      void requestProConfirm('media-process', action.label, () => runMediaProJob(action));
    },
    [proMediaBusy, requireCanvasFile, requestProConfirm, runMediaProJob],
  );

  const onFreeAction = useCallback(
    (action: MediaCanvasAction) => {
      if (action.id === 'exam-photo-optimizer') {
        if (!requireCanvasFile()) return;
        setMediaModal('exam-photo-optimizer');
        return;
      }
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

  const { handleActionClick } = useMediaActionHandler({ onFreeAction, onProAction });
  handleActionClickRef.current = handleActionClick;

  const applyOmniIntent = useCallback((intentId: string) => {
    const actionId = resolveMediaOmniAction(intentId);
    if (actionId) {
      handleActionClickRef.current(actionId);
      return;
    }

    const modal = resolveMediaOmniModal(intentId);
    if (!modal) {
      setToastMessage(`The "${intentId}" action is not wired yet. Pick a tool from the toolbar.`);
      return;
    }

    setMediaModal(modal);
  }, []);

  const onOmniHandoff = useCallback(
    ({ file, intentId }: OmniHandoffPayload) => {
      if (!isImageMimeOrName(file.type, file.name)) {
        setToastMessage('Image Studio accepts JPG, PNG, and WebP images. Upload from the homepage or drop here.');
        return;
      }
      pendingOmniIntentRef.current = intentId;
      activateFile(file);
    },
    [activateFile],
  );

  const omniHandoffStatus = useOmniWorkspaceHandoff({
    workspaceId: 'image',
    enabled: hydrated,
    onHandoff: onOmniHandoff,
    onError: setToastMessage,
  });

  useEffect(() => {
    if (!activeFile?.file || !pendingOmniIntentRef.current) return;
    const intentId = pendingOmniIntentRef.current;
    pendingOmniIntentRef.current = null;
    applyOmniIntent(intentId);
  }, [activeFile?.file, applyOmniIntent]);

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

  if (!hydrated || omniHandoffStatus === 'loading') {
    return <OmniHandoffLoading />;
  }

  return (
    <section className="px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-canvas-accent">Workspace</p>
          <div className="mt-2 flex items-start gap-3">
            <span className="text-3xl" aria-hidden="true">
              🖼️
            </span>
            <div>
              <h1 className="text-2xl font-bold text-canvas-text sm:text-3xl">Image Studio</h1>
              <p className="mt-1 text-sm font-medium leading-relaxed text-slate-200">
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
                className="rounded-xl border border-canvas-border bg-canvas-elevated px-4 py-3 text-sm font-medium leading-relaxed text-slate-200"
                role="status"
              >
                Session restored after refresh. Your file metadata is preserved — re-upload below to run
                actions on a fresh copy.
              </p>
            )}

            <div className="rounded-2xl border border-canvas-border bg-canvas-surface p-4 shadow-none sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-canvas-accent-soft text-2xl"
                    aria-hidden="true"
                  >
                    🖼️
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-canvas-text">{activeFile.meta.name}</p>
                    <p className="mt-0.5 text-xs font-medium leading-relaxed text-slate-300">
                      {formatFileSize(activeFile.meta.size)}
                      {activeFile.meta.type ? ` · ${activeFile.meta.type}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-canvas-border bg-canvas-surface px-3 py-2 text-xs font-semibold text-canvas-muted transition hover:bg-canvas-elevated">
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
                    className="inline-flex items-center justify-center rounded-lg border border-canvas-border px-3 py-2 text-xs font-semibold text-canvas-muted transition hover:border-canvas-border hover:bg-canvas-danger-soft/30 hover:text-rose-200"
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

      {mediaModal === 'exam-photo-optimizer' && canvasImageFile && (
        <ExamPhotoOptimizerModal
          file={canvasImageFile}
          onClose={() => setMediaModal(null)}
          onSuccess={setToastMessage}
          onProcessingChange={onProcessingChange}
        />
      )}

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
      {proCreditModal}
    </section>
  );
}
