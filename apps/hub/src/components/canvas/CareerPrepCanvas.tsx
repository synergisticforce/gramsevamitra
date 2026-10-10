import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CareerCanvasAction } from '../../config/careerCanvasActions';
import {
  careerToolbarActions,
  isCareerDocumentMimeOrName,
} from '../../config/careerCanvasActions';
import { isDocxFile, isPdfFile } from '../../lib/canvas/careerPdfText';
import {
  clearCareerCanvasState,
  formatFileSize,
  loadCareerCanvasState,
  saveCareerCanvasState,
  type StoredFileMeta,
} from '../../lib/canvas/careerCanvasStorage';
import { useCareerActionHandler } from '../../lib/canvas/useCareerActionHandler';
import type { OmniHandoffPayload } from '../../lib/omni/handoff';
import { resolveCareerOmniModal } from '../../lib/omni/omniDispatch';
import { useOmniWorkspaceHandoff } from '../../lib/omni/useOmniWorkspaceHandoff';
import OmniHandoffLoading from '../omni/OmniHandoffLoading';
import AtsScannerModal from './AtsScannerModal';
import BusinessCardModal from './BusinessCardModal';
import CanvasProcessingOverlay from './CanvasProcessingOverlay';
import CanvasToast from './CanvasToast';
import CareerActionToolbar from './CareerActionToolbar';
import CareerMagicDropzone from './CareerMagicDropzone';
import CoverLetterModal from './CoverLetterModal';
import LegalTemplatesModal from './LegalTemplatesModal';
import SkillGapModal from './SkillGapModal';

type CanvasPhase = 'empty' | 'active';
type CareerToolModal =
  | 'business-card'
  | 'skill-gap-analyzer'
  | 'legal-templates'
  | 'ats-scanner'
  | 'cover-letter'
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

const CAREER_AI_COMING_SOON = 'Coming soon — being upgraded to a real AI model.';

export default function CareerPrepCanvas() {
  const [phase, setPhase] = useState<CanvasPhase>('empty');
  const [activeFile, setActiveFile] = useState<ActiveFile | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [careerModal, setCareerModal] = useState<CareerToolModal>(null);
  const [processing, setProcessing] = useState<ProcessingState>({
    active: false,
    label: '',
    percent: 0,
  });
  const pendingOmniIntentRef = useRef<string | null>(null);

  const dismissToast = useCallback(() => setToastMessage(null), []);

  const requireCanvasFile = useCallback((): File | null => {
    if (!activeFile?.file) {
      setToastMessage('Re-upload your document on the canvas to run this action.');
      return null;
    }
    if (!isCareerDocumentMimeOrName(activeFile.meta.type, activeFile.meta.name)) {
      setToastMessage('Career Prep accepts PDF and Word (DOCX) documents only.');
      return null;
    }
    return activeFile.file;
  }, [activeFile]);

  const onProcessingChange = useCallback(
    (active: boolean, label: string, percent: number, subtitle?: string) => {
      if (!active) {
        setProcessing({ active: false, label: '', percent: 0 });
        return;
      }
      setProcessing({ active: true, label, percent, subtitle });
    },
    []
  );

  const onFreeAction = useCallback(
    (action: CareerCanvasAction) => {
      if (action.id === 'business-card') {
        setCareerModal('business-card');
        return;
      }
      if (action.id === 'skill-gap-analyzer') {
        setCareerModal('skill-gap-analyzer');
        return;
      }
      if (action.id === 'legal-templates') {
        setCareerModal('legal-templates');
        return;
      }
      if (action.id === 'ats-scanner') {
        const file = requireCanvasFile();
        if (!file) return;

        if (isDocxFile(file.type, file.name) || (!isPdfFile(file.type, file.name) && !file.type)) {
          setToastMessage(
            'ATS Scanner currently supports PDF resumes only. Upload a PDF or use Cover Letter Templates for Word files.'
          );
          return;
        }

        setCareerModal('ats-scanner');
        return;
      }

      if (action.id === 'cover-letter-templates') {
        if (!activeFile) {
          setToastMessage('Upload a document on the canvas first.');
          return;
        }
        setCareerModal('cover-letter');
      }
    },
    [activeFile, requireCanvasFile]
  );

  const activateFile = useCallback((file: File) => {
    if (!isCareerDocumentMimeOrName(file.type, file.name)) {
      setToastMessage('Please upload a PDF or Word (DOCX) document.');
      return;
    }
    saveCareerCanvasState(file);
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
    const stored = loadCareerCanvasState();
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

  const applyOmniIntent = useCallback(
    (intentId: string) => {
      const modal = resolveCareerOmniModal(intentId);
      if (!modal) {
        setToastMessage(`The "${intentId}" action is not wired yet. Pick a tool from the toolbar.`);
        return;
      }

      if (modal === 'ats-scanner') {
        const file = activeFile?.file;
        if (!file) {
          setToastMessage('Re-upload your document on the canvas to run ATS Scan.');
          return;
        }
        if (isDocxFile(file.type, file.name) || (!isPdfFile(file.type, file.name) && !file.type)) {
          setToastMessage(
            'ATS Scanner currently supports PDF resumes only. Upload a PDF from the homepage or drop here.',
          );
          return;
        }
      }

      setCareerModal(modal);
    },
    [activeFile],
  );

  const onOmniHandoff = useCallback(
    ({ file, intentId }: OmniHandoffPayload) => {
      if (!isCareerDocumentMimeOrName(file.type, file.name)) {
        setToastMessage('Career Prep accepts PDF or Word (DOCX) documents. Upload from the homepage or drop here.');
        return;
      }
      pendingOmniIntentRef.current = intentId;
      activateFile(file);
    },
    [activateFile],
  );

  const omniHandoffStatus = useOmniWorkspaceHandoff({
    workspaceId: 'career',
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

  const { handleActionClick } = useCareerActionHandler({ onFreeAction });

  const onToolbarAction = useCallback(
    (actionId: string) => {
      if (actionId === 'ai-resume-rewriter' || actionId === 'ai-cover-letter') {
        setToastMessage(CAREER_AI_COMING_SOON);
        return;
      }
      handleActionClick(actionId);
    },
    [handleActionClick],
  );

  const clearCanvas = useCallback(() => {
    clearCareerCanvasState();
    setActiveFile(null);
    setPhase('empty');
    setCareerModal(null);
  }, []);

  const replaceFile = useCallback(
    (file: File) => {
      activateFile(file);
    },
    [activateFile]
  );

  const toolbarActions = useMemo(() => {
    const hasDocument = Boolean(activeFile?.file);
    const mimeType = activeFile?.meta.type ?? '';
    const fileName = activeFile?.meta.name ?? '';
    return careerToolbarActions(hasDocument, mimeType, fileName);
  }, [activeFile]);

  const atsFile =
    activeFile?.file && isPdfFile(activeFile.file.type, activeFile.file.name)
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
              🎯
            </span>
            <div>
              <h1 className="text-2xl font-bold text-canvas-text sm:text-3xl">Career Prep</h1>
              <p className="mt-1 text-sm font-medium leading-relaxed text-slate-200">
                ATS scanning, cover letters, and AI resume helpers — drop your resume or cover letter
                to begin.
              </p>
            </div>
          </div>
        </header>

        {phase === 'empty' && (
          <CareerMagicDropzone
            onFileSelect={activateFile}
            onInvalidFile={() => setToastMessage('Please upload a PDF or Word (DOCX) document.')}
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
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-canvas-elevated text-2xl"
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
                      accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,application/msword,.doc"
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

            <CareerActionToolbar actions={toolbarActions} onActionClick={onToolbarAction} />
          </div>
        )}
      </div>

      {careerModal === 'business-card' && (
        <BusinessCardModal
          onClose={() => setCareerModal(null)}
          onSuccess={setToastMessage}
          onProcessingChange={onProcessingChange}
        />
      )}

      {careerModal === 'skill-gap-analyzer' && (
        <SkillGapModal onClose={() => setCareerModal(null)} onSuccess={setToastMessage} />
      )}

      {careerModal === 'legal-templates' && (
        <LegalTemplatesModal onClose={() => setCareerModal(null)} onSuccess={setToastMessage} />
      )}

      {careerModal === 'ats-scanner' && atsFile && (
        <AtsScannerModal
          file={atsFile}
          onClose={() => setCareerModal(null)}
          onSuccess={(message) => setToastMessage(message)}
          onProcessingChange={onProcessingChange}
        />
      )}

      {careerModal === 'cover-letter' && (
        <CoverLetterModal
          onClose={() => setCareerModal(null)}
          onSuccess={(message) => setToastMessage(message)}
        />
      )}

      {processing.active && (
        <CanvasProcessingOverlay
          label={processing.label}
          percent={processing.percent}
          subtitle={processing.subtitle ?? 'Your resume and job description never leave this device.'}
        />
      )}

      <CanvasToast message={toastMessage} onDismiss={dismissToast} />
    </section>
  );
}
