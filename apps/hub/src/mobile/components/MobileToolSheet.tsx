import { Suspense, lazy, useMemo, useState } from 'react';
import {
  actionsForMimeType,
  type DocumentCanvasAction,
} from '../../config/documentCanvasActions';

const SplitPdfModal = lazy(() => import('../../components/canvas/SplitPdfModal'));
const CompressPdfModal = lazy(() => import('../../components/canvas/CompressPdfModal'));
const ProtectPdfModal = lazy(() => import('../../components/canvas/ProtectPdfModal'));
const UnlockPdfModal = lazy(() => import('../../components/canvas/UnlockPdfModal'));
const RemovePagesPdfModal = lazy(() => import('../../components/canvas/RemovePagesPdfModal'));
const PageNumbersPdfModal = lazy(() => import('../../components/canvas/PageNumbersPdfModal'));
const RotatePdfModal = lazy(() => import('../../components/canvas/RotatePdfModal'));
const ReorderPdfModal = lazy(() => import('../../components/canvas/ReorderPdfModal'));
const WatermarkPdfModal = lazy(() => import('../../components/canvas/WatermarkPdfModal'));
const OrganisePdfModal = lazy(() => import('../../components/canvas/OrganisePdfModal'));
const RepairPdfModal = lazy(() => import('../../components/canvas/RepairPdfModal'));
const StripMetadataPdfModal = lazy(() => import('../../components/canvas/StripMetadataPdfModal'));
const SignPdfModal = lazy(() => import('../../components/canvas/SignPdfModal'));
const RedactPdfModal = lazy(() => import('../../components/canvas/RedactPdfModal'));
const CropPdfModal = lazy(() => import('../../components/canvas/CropPdfModal'));
const DeskewPdfModal = lazy(() => import('../../components/canvas/DeskewPdfModal'));
const PdfToImageModal = lazy(() => import('../../components/canvas/PdfToImageModal'));
const ImageToPdfModal = lazy(() => import('../../components/canvas/ImageToPdfModal'));
const PhotoScannedPdfModal = lazy(() => import('../../components/canvas/PhotoScannedPdfModal'));
const SearchablePdfModal = lazy(() => import('../../components/canvas/SearchablePdfModal'));

/** Tools that need a second file or a desktop-sized canvas are left out. */
const MOBILE_EXCLUDED = new Set(['merge', 'type-save', 'to-editable-format', 'vision-ocr']);

interface Props {
  file: File;
  fileName: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

function SheetFallback() {
  return (
    <div className="flex min-h-32 items-center justify-center" role="status" aria-live="polite">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-canvas-border border-t-canvas-accent"
        aria-hidden="true"
      />
    </div>
  );
}

export default function MobileToolSheet({
  file,
  fileName,
  onClose,
  onSuccess,
  onError,
  onProcessingChange,
}: Props) {
  const [activeTool, setActiveTool] = useState<string | null>(null);

  const tools = useMemo(
    () =>
      actionsForMimeType(file.type, fileName).filter(
        (action: DocumentCanvasAction) => !MOBILE_EXCLUDED.has(action.id),
      ),
    [file.type, fileName],
  );

  const closeTool = () => setActiveTool(null);
  const finish = (message: string) => {
    onSuccess(message);
    setActiveTool(null);
    onClose();
  };

  const modalProps = {
    file,
    onClose: closeTool,
    onSuccess: finish,
    onProcessingChange,
  };

  if (activeTool) {
    return (
      <Suspense fallback={<SheetFallback />}>
        {activeTool === 'split' && <SplitPdfModal {...modalProps} />}
        {activeTool === 'compress' && <CompressPdfModal {...modalProps} />}
        {activeTool === 'protect' && <ProtectPdfModal {...modalProps} />}
        {activeTool === 'unlock' && <UnlockPdfModal {...modalProps} onError={onError} />}
        {activeTool === 'remove-pages' && <RemovePagesPdfModal {...modalProps} />}
        {activeTool === 'page-numbers' && <PageNumbersPdfModal {...modalProps} />}
        {activeTool === 'rotate' && <RotatePdfModal {...modalProps} />}
        {activeTool === 'reorder' && <ReorderPdfModal {...modalProps} />}
        {activeTool === 'watermark' && <WatermarkPdfModal {...modalProps} />}
        {activeTool === 'organise-pages' && <OrganisePdfModal {...modalProps} />}
        {activeTool === 'repair-pdf' && <RepairPdfModal {...modalProps} />}
        {activeTool === 'strip-metadata' && <StripMetadataPdfModal {...modalProps} />}
        {activeTool === 'sign-pdf' && <SignPdfModal {...modalProps} />}
        {activeTool === 'redact-pdf' && <RedactPdfModal {...modalProps} />}
        {activeTool === 'crop' && <CropPdfModal {...modalProps} />}
        {activeTool === 'deskew' && <DeskewPdfModal {...modalProps} />}
        {activeTool === 'pdf-to-image' && <PdfToImageModal {...modalProps} />}
        {activeTool === 'image-to-pdf' && <ImageToPdfModal {...modalProps} />}
        {activeTool === 'photo-scanned-pdf' && <PhotoScannedPdfModal {...modalProps} />}
        {activeTool === 'searchable-pdf' && <SearchablePdfModal {...modalProps} />}
      </Suspense>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[75] flex items-end justify-center bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-tools-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-canvas-border bg-canvas-surface pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-canvas-border bg-canvas-surface px-4 pb-3 pt-4">
          <div className="min-w-0">
            <h2 id="mobile-tools-title" className="text-base font-bold text-canvas-text">
              Tools
            </h2>
            <p className="mt-0.5 truncate text-xs font-medium text-slate-300">{fileName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-canvas-border text-canvas-muted"
            aria-label="Close tools"
          >
            ✕
          </button>
        </div>

        {tools.length === 0 ? (
          <p className="px-4 py-6 text-sm font-medium leading-relaxed text-slate-300">
            No tools available for this file type yet.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 px-4 py-4">
            {tools.map((tool) => (
              <li key={tool.id}>
                <button
                  type="button"
                  onClick={() => setActiveTool(tool.id)}
                  className="flex min-h-[5.5rem] w-full flex-col items-start gap-2 rounded-xl border border-canvas-border bg-canvas-elevated px-3 py-3 text-left transition active:scale-[0.98]"
                >
                  <span className="text-2xl leading-none" aria-hidden="true">
                    {tool.icon}
                  </span>
                  <span className="text-sm font-semibold text-canvas-text">{tool.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="px-4 pb-2 text-xs font-medium leading-relaxed text-slate-400">
          All these tools run on your phone. No internet needed.
        </p>
      </div>
    </div>
  );
}
