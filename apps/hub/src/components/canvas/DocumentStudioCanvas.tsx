import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DocumentCanvasAction } from '../../config/documentCanvasActions';
import { actionsForMimeType } from '../../config/documentCanvasActions';
import {
  clearDocumentCanvasState,
  formatFileSize,
  loadDocumentCanvasState,
  saveDocumentCanvasState,
  type StoredFileMeta,
} from '../../lib/canvas/documentCanvasStorage';
import { isPdfMimeOrName } from '../../lib/canvas/documentPdfTools';
import { useDocumentActionHandler } from '../../lib/canvas/useDocumentActionHandler';
import CanvasProcessingOverlay from './CanvasProcessingOverlay';
import CanvasToast from './CanvasToast';
import DocumentActionToolbar from './DocumentActionToolbar';
import MagicDropzone from './MagicDropzone';
import CompressPdfModal from './CompressPdfModal';
import MergePdfModal from './MergePdfModal';
import ProtectPdfModal from './ProtectPdfModal';
import SplitPdfModal from './SplitPdfModal';
import UnlockPdfModal from './UnlockPdfModal';

type CanvasPhase = 'empty' | 'active';
type PdfToolModal = 'split' | 'merge' | 'compress' | 'protect' | 'unlock' | null;

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
  const [pdfModal, setPdfModal] = useState<PdfToolModal>(null);
  const [processing, setProcessing] = useState<ProcessingState>({
    active: false,
    label: '',
    percent: 0,
  });
  const [smartExtractBusy, setSmartExtractBusy] = useState(false);

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
    async (action: DocumentCanvasAction) => {
      if (action.id !== 'smart-extract') return;
      if (smartExtractBusy) return;

      const file = requireCanvasFile();
      if (!file) return;

      setSmartExtractBusy(true);
      setProcessingProgress(
        true,
        'Uploading document to secure transient storage…',
        5,
        'Pro processing uses ephemeral Cloudflare R2 storage — deleted after extraction.'
      );

      try {
        const { runSmartExtractPipeline } = await import('../../lib/canvas/documentSmartExtract');
        const result = await runSmartExtractPipeline(file, ({ label, percent }) => {
          setProcessingProgress(
            true,
            label,
            percent,
            'Pro processing uses ephemeral Cloudflare R2 storage — deleted after extraction.'
          );
        });
        setProcessingProgress(false, '', 0);
        const seconds =
          result.processingMs != null ? Math.round(result.processingMs / 1000) : 3;
        setToastMessage(
          `Smart Extract complete — ${result.fileName} downloaded (${seconds}s mock GPU pipeline).`
        );
      } catch (err) {
        setProcessingProgress(false, '', 0);
        setToastMessage(
          err instanceof Error ? err.message : 'Smart Extract failed. Please try again.'
        );
      } finally {
        setSmartExtractBusy(false);
      }
    },
    [requireCanvasFile, setProcessingProgress, smartExtractBusy]
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
      setToastMessage(`${action.label} is coming soon.`);
    },
    [requirePdfCanvasFile]
  );

  const { handleActionClick } = useDocumentActionHandler({ onFreeAction, onProAction });

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
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Workspace</p>
          <div className="mt-2 flex items-start gap-3">
            <span className="text-3xl" aria-hidden="true">
              📄
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Document Studio</h1>
              <p className="mt-1 text-sm text-slate-600">
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
                className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                role="status"
              >
                Session restored after refresh. Your file metadata is preserved — re-upload below to run
                actions on a fresh copy.
              </p>
            )}

            <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-2xl"
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
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-800"
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
