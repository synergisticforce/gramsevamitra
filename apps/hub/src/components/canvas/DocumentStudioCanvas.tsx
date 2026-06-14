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
import { useDocumentActionHandler } from '../../lib/canvas/useDocumentActionHandler';
import CanvasToast from './CanvasToast';
import DocumentActionToolbar from './DocumentActionToolbar';
import MagicDropzone from './MagicDropzone';

type CanvasPhase = 'empty' | 'active';

interface ActiveFile {
  file: File | null;
  meta: StoredFileMeta;
  restoredFromSession: boolean;
}

export default function DocumentStudioCanvas() {
  const [phase, setPhase] = useState<CanvasPhase>('empty');
  const [activeFile, setActiveFile] = useState<ActiveFile | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const dismissToast = useCallback(() => setToastMessage(null), []);

  const onProAction = useCallback((_action: DocumentCanvasAction) => {
    setToastMessage('Initiating Serverless GPU processing…');
  }, []);

  const onFreeAction = useCallback((action: DocumentCanvasAction) => {
    setToastMessage(`${action.label} queued — processing logic ships in Phase 4.`);
  }, []);

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
  }, []);

  const replaceFile = useCallback(
    (file: File) => {
      activateFile(file);
    },
    [activateFile],
  );

  const toolbarActions = useMemo(() => {
    if (!activeFile) return [];
    return actionsForMimeType(activeFile.meta.type);
  }, [activeFile]);

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

      <CanvasToast message={toastMessage} onDismiss={dismissToast} />
    </section>
  );
}
