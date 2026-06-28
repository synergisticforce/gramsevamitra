import { useCallback, useEffect, useState } from 'react';
import { OCR_WATERFALL_LOADER_STAGES } from '@shared/utils/ocrQuality';
import {
  extractPdfTextInBrowser,
  isPdfEmbeddedTextThin,
  splitFilenameBase,
  triggerTextDownload,
} from '../../lib/canvas/documentPdfTools';
import { promptProUpgradeAfterTier1Failure } from '../../lib/ocr/ocrWaterfallPipeline';
import { runTier1TesseractOcr } from '../../lib/ocr/tesseractTier1';
import { requiresChunkedPipeline } from '../../lib/pdf/fileUploadLimits';
import { runChunkedExtractTextPipeline } from '../../lib/upload/chunkedPipeline';

interface Props {
  file: File;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

type ExtractionSource = 'embedded' | 'tier1-ocr';

export default function PdfToTextModal({ file, onClose, onSuccess, onProcessingChange }: Props) {
  const [text, setText] = useState('');
  const [pageCount, setPageCount] = useState(0);
  const [pagesSampled, setPagesSampled] = useState(0);
  const [extractionSource, setExtractionSource] = useState<ExtractionSource>('embedded');
  const [needsProOcr, setNeedsProOcr] = useState(false);
  const [busy, setBusy] = useState(true);
  const [copyBusy, setCopyBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setBusy(true);
      setError(null);
      setNeedsProOcr(false);
      setText('');
      setPagesSampled(0);
      setExtractionSource('embedded');
      onProcessingChange(true, 'Extracting text…', 0);

      try {
        if (requiresChunkedPipeline(file)) {
          const result = await runChunkedExtractTextPipeline(file, ({ label, percent }) =>
            onProcessingChange(true, label, percent),
          );
          if (cancelled) return;
          setText(result.text);
          setPageCount(result.pageCount);
          onProcessingChange(false, '', 0);
          return;
        }

        const embedded = await extractPdfTextInBrowser(file, ({ current, total, label }) => {
          const percent = total > 0 ? Math.round((current / total) * 100) : 0;
          onProcessingChange(true, label, percent);
        });
        if (cancelled) return;

        if (!isPdfEmbeddedTextThin(embedded.text, embedded.pageCount)) {
          setText(embedded.text);
          setPageCount(embedded.pageCount);
          setExtractionSource('embedded');
          onProcessingChange(false, '', 0);
          return;
        }

        onProcessingChange(true, OCR_WATERFALL_LOADER_STAGES.tier1, 0);
        const tier1 = await runTier1TesseractOcr(file, (label, percent) =>
          onProcessingChange(true, label, percent),
        );
        if (cancelled) return;

        if (tier1.needsProHandoff) {
          setNeedsProOcr(true);
          setPageCount(embedded.pageCount);
          promptProUpgradeAfterTier1Failure(tier1);
          onProcessingChange(false, '', 0);
          return;
        }

        setText(tier1.text);
        setPageCount(embedded.pageCount);
        setPagesSampled(tier1.pagesSampled);
        setExtractionSource('tier1-ocr');
        onProcessingChange(false, '', 0);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Text extraction failed.');
        onProcessingChange(false, '', 0);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file, onProcessingChange]);

  const handleCopy = useCallback(async () => {
    if (!text) return;
    setCopyBusy(true);
    try {
      await navigator.clipboard.writeText(text);
      onSuccess('Text copied to clipboard.');
    } catch {
      setError('Could not copy to clipboard. Try downloading as .txt instead.');
    } finally {
      setCopyBusy(false);
    }
  }, [onSuccess, text]);

  const handleDownload = useCallback(() => {
    if (!text) return;
    const baseName = splitFilenameBase(file.name);
    triggerTextDownload(text, `${baseName}.txt`);
    onSuccess('Text file download started.');
  }, [file.name, onSuccess, text]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-to-text-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="pdf-to-text-title" className="text-lg font-bold text-canvas-text">
              PDF to Text
            </h2>
            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-300 truncate">{file.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg px-2 py-1 text-canvas-subtle transition hover:bg-canvas-elevated hover:text-canvas-muted disabled:opacity-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {busy ? (
          <p className="mt-4 text-sm font-medium leading-relaxed text-slate-200">Extracting text from your PDF…</p>
        ) : needsProOcr ? (
          <div className="mt-4 space-y-3">
            <p className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
              This PDF appears to be a scan. Free on-device OCR could not reach our 65% confidence bar on the
              sample pages. Upgrade to Pro for the Paddle → GLM → Vision extraction pipeline.
            </p>
            <p className="text-xs font-medium leading-relaxed text-slate-300">
              The Pro upgrade dialog should be open. If not, use Smart Extract from the toolbar after upgrading.
            </p>
          </div>
        ) : error ? (
          <p className="mt-4 rounded-lg border border-canvas-border bg-canvas-danger-soft/30 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        ) : (
          <>
            <p className="mt-4 text-sm font-medium leading-relaxed text-slate-200">
              {extractionSource === 'tier1-ocr' ? (
                <>
                  Scanned PDF detected — free OCR extracted text from the first{' '}
                  <span className="font-semibold text-canvas-text">{pagesSampled}</span> page
                  {pagesSampled === 1 ? '' : 's'} ({pageCount} total). Copy or download instantly.
                </>
              ) : (
                <>
                  Extracted text from{' '}
                  <span className="font-semibold text-canvas-text">{pageCount}</span> page
                  {pageCount === 1 ? '' : 's'}. Copy or download instantly — nothing leaves your device.
                </>
              )}
            </p>
            <textarea
              readOnly
              value={text}
              rows={12}
              className="mt-3 w-full rounded-xl border border-canvas-border bg-canvas-elevated px-3 py-2.5 font-mono text-xs text-canvas-text outline-none"
            />
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => void handleCopy()}
                disabled={!text || copyBusy}
                className="flex-1 rounded-xl border border-canvas-border px-4 py-2.5 text-sm font-semibold text-canvas-muted transition hover:bg-canvas-elevated disabled:cursor-not-allowed disabled:opacity-50"
              >
                {copyBusy ? 'Copying…' : 'Copy to clipboard'}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={!text}
                className="flex-1 rounded-xl bg-canvas-accent-muted px-4 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Download .txt
              </button>
            </div>
          </>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-canvas-border px-4 py-2.5 text-sm font-semibold text-canvas-muted transition hover:bg-canvas-elevated disabled:opacity-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
