import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DocumentCanvasAction } from '../../config/documentCanvasActions';
import { actionsForMimeType } from '../../config/documentCanvasActions';
import {
  clearDocumentCanvasState,
  formatFileSize,
  loadDocumentCanvasState,
  saveDocumentCanvasState,
  type StoredFileMeta,
} from '../../lib/canvas/documentCanvasStorage';
import { isImageMimeOrName, isPdfMimeOrName } from '../../lib/canvas/documentPdfTools';
import { useDocumentActionHandler } from '../../lib/canvas/useDocumentActionHandler';
import type { OmniHandoffPayload } from '../../lib/omni/handoff';
import {
  DOCUMENT_PDF_ONLY_MODALS,
  resolveDocumentOmniAction,
  resolveDocumentOmniModal,
} from '../../lib/omni/omniDispatch';
import { useOmniWorkspaceHandoff } from '../../lib/omni/useOmniWorkspaceHandoff';
import { useProCreditConfirm } from '../../lib/auth/useProCreditConfirm';
import OmniHandoffLoading from '../omni/OmniHandoffLoading';
import CanvasProcessingOverlay from './CanvasProcessingOverlay';
import CanvasToast from './CanvasToast';
import DocumentActionToolbar from './DocumentActionToolbar';
import MagicDropzone from './MagicDropzone';
import CompressPdfModal from './CompressPdfModal';
import CropPdfModal from './CropPdfModal';
import DeskewPdfModal from './DeskewPdfModal';
import HiFiConverterModal from './HiFiConverterModal';
import ImageToPdfModal from './ImageToPdfModal';
import MergePdfModal from './MergePdfModal';
import PageNumbersPdfModal from './PageNumbersPdfModal';
import PdfToImageModal from './PdfToImageModal';
import PdfToTextModal from './PdfToTextModal';
import ProtectPdfModal from './ProtectPdfModal';
import RemovePagesPdfModal from './RemovePagesPdfModal';
import ReorderPdfModal from './ReorderPdfModal';
import RotatePdfModal from './RotatePdfModal';
import SplitPdfModal from './SplitPdfModal';
import TypeSavePdfModal from './TypeSavePdfModal';
import UnlockPdfModal from './UnlockPdfModal';
import WatermarkPdfModal from './WatermarkPdfModal';

type CanvasPhase = 'empty' | 'active';
type ToolModal =
  | 'split'
  | 'merge'
  | 'compress'
  | 'protect'
  | 'unlock'
  | 'deskew'
  | 'remove-pages'
  | 'page-numbers'
  | 'crop'
  | 'image-to-pdf'
  | 'pdf-to-image'
  | 'pdf-to-text'
  | 'type-save'
  | 'rotate'
  | 'reorder'
  | 'watermark'
  | 'hifi-convert'
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

export default function DocumentStudioCanvas() {
  const [phase, setPhase] = useState<CanvasPhase>('empty');
  const [activeFile, setActiveFile] = useState<ActiveFile | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pdfModal, setPdfModal] = useState<ToolModal>(null);
  const [processing, setProcessing] = useState<ProcessingState>({
    active: false,
    label: '',
    percent: 0,
  });
  const [smartExtractBusy, setSmartExtractBusy] = useState(false);
  const { requestProConfirm, proCreditModal } = useProCreditConfirm();
  const pendingOmniIntentRef = useRef<string | null>(null);
  const handleActionClickRef = useRef<(actionId: string) => void>(() => {});

  const dismissToast = useCallback(() => setToastMessage(null), []);

  const requireCanvasFile = useCallback((): File | null => {
    if (!activeFile?.file) {
      setToastMessage('Re-upload your file on the canvas to run this action.');
      return null;
    }
    return activeFile.file;
  }, [activeFile]);

  const requirePdfCanvasFile = useCallback((): File | null => {
    const file = requireCanvasFile();
    if (!file) return null;
    if (!isPdfMimeOrName(activeFile!.meta.type, activeFile!.meta.name)) {
      setToastMessage('This action is available for PDF files only.');
      return null;
    }
    return file;
  }, [activeFile, requireCanvasFile]);

  const requireImageCanvasFile = useCallback((): File | null => {
    const file = requireCanvasFile();
    if (!file) return null;
    if (!isImageMimeOrName(activeFile!.meta.type, activeFile!.meta.name)) {
      setToastMessage('This action is available for image files only.');
      return null;
    }
    return file;
  }, [activeFile, requireCanvasFile]);

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

  const runSmartExtractJob = useCallback(
    async (file: File) => {
      setSmartExtractBusy(true);
      setProcessingProgress(
        true,
        'Preparing Smart Extract…',
        5,
        'Pro processing uses secure temporary storage — deleted immediately after extraction.',
      );

      try {
        const { runSmartExtractPipeline } = await import('../../lib/canvas/documentSmartExtract');
        const result = await runSmartExtractPipeline(file, ({ label, percent }) => {
          setProcessingProgress(
            true,
            label,
            percent,
            'Pro processing uses secure temporary storage — deleted immediately after extraction.',
          );
        });
        setProcessingProgress(false, '', 0);
        const seconds =
          result.processingMs != null ? Math.round(result.processingMs / 1000) : 3;
        const creditsNote =
          result.remainingCredits != null ? ` · ${result.remainingCredits} AI Credits left` : '';
        setToastMessage(
          `Smart Extract complete — ${result.fileName} downloaded (${seconds}s)${creditsNote}.`,
        );
      } catch (err) {
        setProcessingProgress(false, '', 0);
        setToastMessage(
          err instanceof Error ? err.message : 'Smart Extract failed. Please try again.',
        );
      } finally {
        setSmartExtractBusy(false);
      }
    },
    [setProcessingProgress],
  );

  const onProAction = useCallback(
    async (action: DocumentCanvasAction) => {
      if (action.id === 'hifi-convert') {
        if (!requirePdfCanvasFile()) return;
        setPdfModal('hifi-convert');
        return;
      }

      if (action.id !== 'smart-extract') return;
      if (smartExtractBusy) return;

      const file = requireCanvasFile();
      if (!file) return;

      void requestProConfirm('smart-extract', action.label, () => runSmartExtractJob(file));
    },
    [requireCanvasFile, requirePdfCanvasFile, requestProConfirm, runSmartExtractJob, smartExtractBusy],
  );

  const onFreeAction = useCallback(
    (action: DocumentCanvasAction) => {
      if (action.id === 'split') {
        if (!requirePdfCanvasFile()) return;
        setPdfModal('split');
        return;
      }
      if (action.id === 'merge') {
        if (!requirePdfCanvasFile()) return;
        setPdfModal('merge');
        return;
      }
      if (action.id === 'compress') {
        if (!requirePdfCanvasFile()) return;
        setPdfModal('compress');
        return;
      }
      if (action.id === 'protect') {
        if (!requirePdfCanvasFile()) return;
        setPdfModal('protect');
        return;
      }
      if (action.id === 'unlock') {
        if (!requirePdfCanvasFile()) return;
        setPdfModal('unlock');
        return;
      }
      if (action.id === 'deskew') {
        if (!requirePdfCanvasFile()) return;
        setPdfModal('deskew');
        return;
      }
      if (action.id === 'remove-pages') {
        if (!requirePdfCanvasFile()) return;
        setPdfModal('remove-pages');
        return;
      }
      if (action.id === 'page-numbers') {
        if (!requirePdfCanvasFile()) return;
        setPdfModal('page-numbers');
        return;
      }
      if (action.id === 'crop') {
        if (!requirePdfCanvasFile()) return;
        setPdfModal('crop');
        return;
      }
      if (action.id === 'image-to-pdf') {
        if (!requireImageCanvasFile()) return;
        setPdfModal('image-to-pdf');
        return;
      }
      if (action.id === 'pdf-to-image') {
        if (!requirePdfCanvasFile()) return;
        setPdfModal('pdf-to-image');
        return;
      }
      if (action.id === 'pdf-to-text') {
        if (!requirePdfCanvasFile()) return;
        setPdfModal('pdf-to-text');
        return;
      }
      if (action.id === 'type-save') {
        setPdfModal('type-save');
        return;
      }
      if (action.id === 'rotate') {
        if (!requirePdfCanvasFile()) return;
        setPdfModal('rotate');
        return;
      }
      if (action.id === 'reorder') {
        if (!requirePdfCanvasFile()) return;
        setPdfModal('reorder');
        return;
      }
      if (action.id === 'watermark') {
        if (!requirePdfCanvasFile()) return;
        setPdfModal('watermark');
        return;
      }
      setToastMessage(`${action.label} is coming soon.`);
    },
    [requireImageCanvasFile, requirePdfCanvasFile]
  );

  const activateFile = useCallback((file: File) => {
    saveDocumentCanvasState(file);
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
    const stored = loadDocumentCanvasState();
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

  const { handleActionClick } = useDocumentActionHandler({ onFreeAction, onProAction });
  handleActionClickRef.current = handleActionClick;

  const applyOmniIntent = useCallback(
    (intentId: string) => {
      const actionId = resolveDocumentOmniAction(intentId);
      if (actionId) {
        handleActionClickRef.current(actionId);
        return;
      }

      const modal = resolveDocumentOmniModal(intentId);
      if (!modal) {
        setToastMessage(`The "${intentId}" action is not wired yet. Pick a tool from the toolbar.`);
        return;
      }

      if (DOCUMENT_PDF_ONLY_MODALS.has(modal)) {
        if (!activeFile?.file || !isPdfMimeOrName(activeFile.meta.type, activeFile.meta.name)) {
          setToastMessage('This Omni action requires a PDF file.');
          return;
        }
      }

      setPdfModal(modal);
    },
    [activeFile],
  );

  const onOmniHandoff = useCallback(
    ({ file, intentId }: OmniHandoffPayload) => {
      pendingOmniIntentRef.current = intentId;
      activateFile(file);
    },
    [activateFile],
  );

  const omniHandoffStatus = useOmniWorkspaceHandoff({
    workspaceId: 'documents',
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
    clearDocumentCanvasState();
    setActiveFile(null);
    setPhase('empty');
    setPdfModal(null);
  }, []);

  const replaceFile = useCallback(
    (file: File) => {
      activateFile(file);
    },
    [activateFile]
  );

  const toolbarActions = useMemo(() => {
    if (!activeFile) return [];
    return actionsForMimeType(activeFile.meta.type);
  }, [activeFile]);

  const canvasPdfFile = activeFile?.file ?? null;
  const canvasImageFile =
    activeFile?.file &&
    isImageMimeOrName(activeFile.meta.type, activeFile.meta.name)
      ? activeFile.file
      : null;

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
              📄
            </span>
            <div>
              <h1 className="text-2xl font-bold text-canvas-text sm:text-3xl">Document Studio</h1>
              <p className="mt-1 text-sm font-medium leading-relaxed text-slate-200">
                Merge, split, compress, protect, or smart-extract — drop a file to begin.
              </p>
            </div>
          </div>
        </header>

        {phase === 'empty' && <MagicDropzone onFileSelect={activateFile} />}

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
                    📎
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
                    Replace file
                    <input
                      type="file"
                      className="sr-only"
                      accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.doc,.docx"
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

            <DocumentActionToolbar actions={toolbarActions} onActionClick={handleActionClick} />
          </div>
        )}
      </div>

      {pdfModal === 'split' && canvasPdfFile && (
        <SplitPdfModal
          file={canvasPdfFile}
          onClose={() => setPdfModal(null)}
          onSuccess={setToastMessage}
          onProcessingChange={onProcessingChange}
        />
      )}

      {pdfModal === 'merge' && canvasPdfFile && (
        <MergePdfModal
          canvasFile={canvasPdfFile}
          onClose={() => setPdfModal(null)}
          onSuccess={setToastMessage}
          onProcessingChange={onProcessingChange}
        />
      )}

      {pdfModal === 'compress' && canvasPdfFile && (
        <CompressPdfModal
          file={canvasPdfFile}
          onClose={() => setPdfModal(null)}
          onSuccess={setToastMessage}
          onProcessingChange={onProcessingChange}
        />
      )}

      {pdfModal === 'protect' && canvasPdfFile && (
        <ProtectPdfModal
          file={canvasPdfFile}
          onClose={() => setPdfModal(null)}
          onSuccess={setToastMessage}
          onProcessingChange={onProcessingChange}
        />
      )}

      {pdfModal === 'unlock' && canvasPdfFile && (
        <UnlockPdfModal
          file={canvasPdfFile}
          onClose={() => setPdfModal(null)}
          onSuccess={setToastMessage}
          onError={setToastMessage}
          onProcessingChange={onProcessingChange}
        />
      )}

      {pdfModal === 'deskew' && canvasPdfFile && (
        <DeskewPdfModal
          file={canvasPdfFile}
          onClose={() => setPdfModal(null)}
          onSuccess={setToastMessage}
          onProcessingChange={onProcessingChange}
        />
      )}

      {pdfModal === 'remove-pages' && canvasPdfFile && (
        <RemovePagesPdfModal
          file={canvasPdfFile}
          onClose={() => setPdfModal(null)}
          onSuccess={setToastMessage}
          onProcessingChange={onProcessingChange}
        />
      )}

      {pdfModal === 'page-numbers' && canvasPdfFile && (
        <PageNumbersPdfModal
          file={canvasPdfFile}
          onClose={() => setPdfModal(null)}
          onSuccess={setToastMessage}
          onProcessingChange={onProcessingChange}
        />
      )}

      {pdfModal === 'crop' && canvasPdfFile && (
        <CropPdfModal
          file={canvasPdfFile}
          onClose={() => setPdfModal(null)}
          onSuccess={setToastMessage}
          onProcessingChange={onProcessingChange}
        />
      )}

      {pdfModal === 'image-to-pdf' && canvasImageFile && (
        <ImageToPdfModal
          file={canvasImageFile}
          onClose={() => setPdfModal(null)}
          onSuccess={setToastMessage}
          onProcessingChange={onProcessingChange}
        />
      )}

      {pdfModal === 'pdf-to-image' && canvasPdfFile && (
        <PdfToImageModal
          file={canvasPdfFile}
          onClose={() => setPdfModal(null)}
          onSuccess={setToastMessage}
          onProcessingChange={onProcessingChange}
        />
      )}

      {pdfModal === 'pdf-to-text' && canvasPdfFile && (
        <PdfToTextModal
          file={canvasPdfFile}
          onClose={() => setPdfModal(null)}
          onSuccess={setToastMessage}
          onProcessingChange={onProcessingChange}
        />
      )}

      {pdfModal === 'type-save' && (
        <TypeSavePdfModal
          onClose={() => setPdfModal(null)}
          onSuccess={setToastMessage}
          onProcessingChange={onProcessingChange}
        />
      )}

      {pdfModal === 'rotate' && canvasPdfFile && (
        <RotatePdfModal
          file={canvasPdfFile}
          onClose={() => setPdfModal(null)}
          onSuccess={setToastMessage}
          onProcessingChange={onProcessingChange}
        />
      )}

      {pdfModal === 'reorder' && canvasPdfFile && (
        <ReorderPdfModal
          file={canvasPdfFile}
          onClose={() => setPdfModal(null)}
          onSuccess={setToastMessage}
          onProcessingChange={onProcessingChange}
        />
      )}

      {pdfModal === 'watermark' && canvasPdfFile && (
        <WatermarkPdfModal
          file={canvasPdfFile}
          onClose={() => setPdfModal(null)}
          onSuccess={setToastMessage}
          onProcessingChange={onProcessingChange}
        />
      )}

      {pdfModal === 'hifi-convert' && canvasPdfFile && (
        <HiFiConverterModal
          file={canvasPdfFile}
          onClose={() => setPdfModal(null)}
          onSuccess={setToastMessage}
          onProcessingChange={setProcessingProgress}
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
