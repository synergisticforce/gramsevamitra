import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MediaCanvasAction } from '../../config/mediaCanvasActions';
import { MEDIA_CANVAS_ACTIONS, actionsForImageMime, isImageMimeOrName } from '../../config/mediaCanvasActions';
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
import ImageCropperModal from './ImageCropperModal';
import ImageFilterModal from './ImageFilterModal';
import ImageToPdfModal from './ImageToPdfModal';
import ImageWatermarkModal from './ImageWatermarkModal';
import MediaActionToolbar from './MediaActionToolbar';
import ResizeCompressModal from './ResizeCompressModal';
import ImageAdjustModal from './ImageAdjustModal';
import RemoveBackgroundModal from './RemoveBackgroundModal';
import ImageEnhanceModal from './ImageEnhanceModal';
import type { EnhanceMode } from '../../lib/canvas/imageEnhance';
import { speakText } from '../../lib/voiceAssist';
import { useDisplayPrefs } from '../../lib/audit/useDisplayPrefs';

type CanvasPhase = 'empty' | 'active';
type MediaToolModal =
  | 'exam-photo-optimizer'
  | 'resize-compress'
  | 'convert-format'
  | 'image-cropper'
  | 'image-watermark'
  | 'image-to-pdf'
  | 'image-filters'
  | 'image-adjust'
  | 'remove-background'
  | EnhanceMode
  | null;

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
  const [photoTask, setPhotoTask] = useState<string | null>(null);
  const [showAllPhoto, setShowAllPhoto] = useState(false);
  const prefs = useDisplayPrefs();
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
      if (action.id === 'image-cropper') {
        if (!requireCanvasFile()) return;
        setMediaModal('image-cropper');
        return;
      }
      if (action.id === 'image-watermark') {
        if (!requireCanvasFile()) return;
        setMediaModal('image-watermark');
        return;
      }
      if (action.id === 'image-to-pdf') {
        if (!requireCanvasFile()) return;
        setMediaModal('image-to-pdf');
        return;
      }
      if (action.id === 'image-filters') {
        if (!requireCanvasFile()) return;
        setMediaModal('image-filters');
        return;
      }
      if (action.id === 'image-adjust') {
        if (!requireCanvasFile()) return;
        setMediaModal('image-adjust');
        return;
      }
      if (action.id === 'remove-background') {
        if (!requireCanvasFile()) return;
        setMediaModal('remove-background');
        return;
      }
      if (action.id === 'upscale-2x' || action.id === 'upscale-4x') {
        if (!requireCanvasFile()) return;
        setMediaModal(action.id);
        return;
      }
      if (action.id === 'photo-restore') {
        if (!requireCanvasFile()) return;
        setMediaModal('restore');
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

  const onUnavailableAction = useCallback((action: { label: string }) => {
    setToastMessage(
      `${action.label} is coming soon. No AI Credits were used. The free tools above work offline right now.`,
    );
  }, []);

  const { handleActionClick } = useMediaActionHandler({
    onFreeAction,
    onProAction,
    onUnavailable: onUnavailableAction,
  });
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
        <header className="mb-4">
          <h1 className="text-3xl font-black text-slate-900">What do you want to do? / क्या करना है?</h1>
        </header>

        {phase === 'empty' && !photoTask && (
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { id: 'exam-photo-optimizer', visual: '🧑 ➔ 🪪 8 Photos', title: 'Passport Photo & 4×6 Sheet', speech: 'Make a passport photo and an eight photo sheet.' },
              { id: 'resize-compress', visual: '🐘 ➔ 🐜 100 KB', title: 'Shrink Photo (<100 KB)', speech: 'Shrink a photo under 100 KB.' },
              { id: 'remove-background', visual: '✂️ 🧑', title: 'Remove Background', speech: 'Remove the photo background.' },
              { id: 'upscale-2x', visual: '🔍 2× / 4×', title: 'Make Photo Clear', speech: 'Make the photo clearer, two times or four times.' },
            ].map((task) => (
              <button key={task.id} type="button" className="min-h-36 rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm" onClick={() => setPhotoTask(task.id)}>
                <span className="text-2xl font-black">{task.visual}</span>
                <span className="mt-3 flex items-center justify-between">
                  <span className="text-xl font-black">{task.title}</span>
                  <span className="min-h-[52px] rounded-full bg-slate-100 px-4 py-3" onClick={(event) => { event.stopPropagation(); speakText(task.speech, prefs.language); }}>🔊</span>
                </span>
              </button>
            ))}
            <button type="button" className="min-h-[52px] rounded-2xl border border-slate-300 bg-slate-100 px-4 font-black text-slate-900 sm:col-span-2" onClick={() => setShowAllPhoto((open) => !open)}>
              ➕ Show All Photo Tools
            </button>
            {showAllPhoto && MEDIA_CANVAS_ACTIONS.map((action) => (
              <button key={action.id} type="button" className="min-h-[52px] rounded-2xl border border-slate-200 bg-white px-4 text-left font-black text-slate-900" onClick={() => setPhotoTask(action.id)}>
                {action.icon} {action.label}
              </button>
            ))}
          </div>
        )}

        {phase === 'empty' && photoTask && (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <button type="button" className="min-h-[52px] font-black" onClick={() => setPhotoTask(null)}>← Back to photo tasks</button>
            <p className="mt-2 text-xl font-black">Step 2: Choose a photo</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex min-h-28 cursor-pointer items-center justify-center rounded-3xl bg-orange-500 text-xl font-black text-white">
                📁 Pick Photo
                <input type="file" accept="image/*" className="sr-only" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  activateFile(file);
                  if (photoTask) setMediaModal(photoTask as MediaToolModal);
                  event.target.value = '';
                }} />
              </label>
              <label className="flex min-h-28 cursor-pointer items-center justify-center rounded-3xl bg-slate-900 text-xl font-black text-white">
                📷 Take Photo with Camera
                <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) activateFile(file);
                  event.target.value = '';
                }} />
              </label>
            </div>
          </div>
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

      {mediaModal === 'image-cropper' && canvasImageFile && (
        <ImageCropperModal
          file={canvasImageFile}
          onClose={() => setMediaModal(null)}
          onSuccess={setToastMessage}
          onProcessingChange={onProcessingChange}
        />
      )}

      {mediaModal === 'image-watermark' && canvasImageFile && (
        <ImageWatermarkModal
          file={canvasImageFile}
          onClose={() => setMediaModal(null)}
          onSuccess={setToastMessage}
          onProcessingChange={onProcessingChange}
        />
      )}

      {mediaModal === 'image-to-pdf' && canvasImageFile && (
        <ImageToPdfModal
          file={canvasImageFile}
          onClose={() => setMediaModal(null)}
          onSuccess={setToastMessage}
          onProcessingChange={onProcessingChange}
        />
      )}

      {mediaModal === 'image-filters' && canvasImageFile && (
        <ImageFilterModal
          file={canvasImageFile}
          onClose={() => setMediaModal(null)}
          onSuccess={setToastMessage}
          onProcessingChange={onProcessingChange}
        />
      )}

      {mediaModal === 'image-adjust' && canvasImageFile && (
        <ImageAdjustModal
          file={canvasImageFile}
          onClose={() => setMediaModal(null)}
          onSuccess={setToastMessage}
          onProcessingChange={onProcessingChange}
        />
      )}

      {mediaModal === 'remove-background' && canvasImageFile && (
        <RemoveBackgroundModal
          file={canvasImageFile}
          onClose={() => setMediaModal(null)}
          onSuccess={setToastMessage}
          onProcessingChange={onProcessingChange}
        />
      )}

      {(mediaModal === 'upscale-2x' || mediaModal === 'upscale-4x' || mediaModal === 'restore') &&
        canvasImageFile && (
          <ImageEnhanceModal
            file={canvasImageFile}
            mode={mediaModal}
            onClose={() => setMediaModal(null)}
            onSuccess={setToastMessage}
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
