import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CareerCanvasAction } from '../../config/careerCanvasActions';
import {
  actionsForCareerMime,
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
import AtsScannerModal from './AtsScannerModal';
import CanvasProcessingOverlay from './CanvasProcessingOverlay';
import CanvasToast from './CanvasToast';
import CareerActionToolbar from './CareerActionToolbar';
import CareerMagicDropzone from './CareerMagicDropzone';
import CoverLetterModal from './CoverLetterModal';

type CanvasPhase = 'empty' | 'active';
type CareerToolModal = 'ats-scanner' | 'cover-letter' | null;

interface ActiveFile {
  file: File | null;
  meta: StoredFileMeta;
  restoredFromSession: boolean;
}

interface ProcessingState {
  active: boolean;
  label: string;
  percent: number;
}

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

  const onProcessingChange = useCallback((active: boolean, label: string, percent: number) => {
    if (!active) {
      setProcessing({ active: false, label: '', percent: 0 });
      return;
    }
    setProcessing({ active: true, label, percent });
  }, []);

  const onFreeAction = useCallback(
    (action: CareerCanvasAction) => {
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

  const onProAction = useCallback((action: CareerCanvasAction) => {
    setToastMessage(`${action.label} — serverless AI processing ships in Phase 6.`);
  }, []);

  const { handleActionClick } = useCareerActionHandler({ onFreeAction, onProAction });

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
    if (!activeFile) return [];
    return actionsForCareerMime(activeFile.meta.type);
  }, [activeFile]);

  const atsFile =
    activeFile?.file && isPdfFile(activeFile.file.type, activeFile.file.name)
      ? activeFile.file
      : null;

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
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">Workspace</p>
          <div className="mt-2 flex items-start gap-3">
            <span className="text-3xl" aria-hidden="true">
              🎯
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Career Prep</h1>
              <p className="mt-1 text-sm text-slate-600">
                ATS scanning, cover letters, and AI resume tools — drop a document to begin.
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
                className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                role="status"
              >
                Session restored after refresh. Your file metadata is preserved — re-upload below to run
                actions on a fresh copy.
              </p>
            )}

            <div className="rounded-2xl border border-sky-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-2xl"
                    aria-hidden="true"
                  >
                    📎
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
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-800"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            <CareerActionToolbar actions={toolbarActions} onActionClick={handleActionClick} />
          </div>
        )}
      </div>

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
          subtitle="Your resume and job description never leave this device."
        />
      )}

      <CanvasToast message={toastMessage} onDismiss={dismissToast} />
    </section>
  );
}
