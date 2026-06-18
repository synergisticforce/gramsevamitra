import { useCallback, useEffect, useState } from 'react';
import { OCR_WATERFALL_LOADER_STAGES } from '@shared/utils/ocrQuality';
import {
  extractPdfTextInBrowser,
  isPdfEmbeddedTextThin,
  isPdfMimeOrName,
  splitFilenameBase,
} from '../../lib/canvas/documentPdfTools';
import { textToDocxBlob, triggerDocxDownload } from '../../lib/canvas/extractToWord';
import { promptProUpgradeForExtractToWord } from '../../lib/ocr/ocrWaterfallPipeline';
import { runTier1TesseractOcr } from '../../lib/ocr/tesseractTier1';
import { requiresChunkedPipeline } from '../../lib/pdf/fileUploadLimits';
import ToolProcessingWait from './ToolProcessingWait';

interface Props {
  file: File;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

export default function ExtractToWordModal({
  file,
  onClose,
  onSuccess,
  onProcessingChange,
}: Props) {
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsPro, setNeedsPro] = useState(false);

  const runExtraction = useCallback(async () => {
    setBusy(true);
    setError(null);
    setNeedsPro(false);
    onProcessingChange(true, 'Preparing Word export…', 0);

    try {
      if (requiresChunkedPipeline(file)) {
        setError(
          'This file exceeds the local size limit. Use Smart Extract (Pro) for high-fidelity Word reconstruction on large scans.',
        );
        onProcessingChange(false, '', 0);
        return;
      }

      let text = '';

      if (isPdfMimeOrName(file.type, file.name)) {
        onProcessingChange(true, 'Reading PDF text layer…', 10);
        const embedded = await extractPdfTextInBrowser(file, ({ current, total, label }) => {
          const percent = total > 0 ? Math.round((current / total) * 40) : 10;
          onProcessingChange(true, label, percent);
        });

        if (!isPdfEmbeddedTextThin(embedded.text, embedded.pageCount)) {
          text = embedded.text;
        }
      }

      if (!text.trim()) {
        onProcessingChange(true, OCR_WATERFALL_LOADER_STAGES.tier1, 45);
        const tier1 = await runTier1TesseractOcr(file, (label, percent) =>
          onProcessingChange(true, label, Math.max(45, percent)),
        );

        if (tier1.needsProHandoff) {
          setNeedsPro(true);
          promptProUpgradeForExtractToWord(tier1);
          onProcessingChange(false, '', 0);
          return;
        }

        text = tier1.text;
      }

      onProcessingChange(true, 'Building Word document…', 90);
      const blob = await textToDocxBlob(text, splitFilenameBase(file.name));
      triggerDocxDownload(blob, file.name);
      onProcessingChange(false, '', 0);
      onSuccess(`Extract to Word complete — ${splitFilenameBase(file.name)}.docx downloaded.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Word export failed.');
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [file, onClose, onProcessingChange, onSuccess]);

  useEffect(() => {
    void runExtraction();
  }, [runExtraction]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="extract-word-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="extract-word-title" className="text-lg font-bold text-canvas-text">
              Extract to Word
            </h2>
            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-300">
              Free local OCR → DOCX when quality passes our 65% confidence bar.
            </p>
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

        <div className="mt-4 rounded-xl border border-canvas-border bg-canvas-accent-soft px-3 py-2.5">
          <p className="truncate text-sm font-medium text-canvas-text">{file.name}</p>
        </div>

        {busy && <ToolProcessingWait label="Extracting text for Word export…" className="mt-4" />}

        {needsPro && (
          <p className="mt-4 rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-3 text-sm font-medium leading-relaxed text-slate-200">
            This document format or quality requires advanced processing. Upgrade to GramSeva Mitra
            Pro to deploy high-fidelity AI formatting engines (Paddle OCR/GLM OCR) to reconstruct
            this Word file.
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-canvas-border bg-canvas-danger-soft/30 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-canvas-border px-4 py-2.5 text-sm font-semibold text-canvas-muted transition hover:bg-canvas-elevated disabled:opacity-50"
          >
            {needsPro || error ? 'Close' : busy ? 'Working…' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
