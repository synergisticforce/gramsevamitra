import { useCallback, useState } from 'react';
import { ActionButton, FileDropZone, SelectedFileStatus, StatusMessage } from './ToolWorkspaceShell';
import { useToolProgress } from './ToolProgressContext';
import { loadPdfDocument, renderPdfPageToCanvas } from '../../lib/pdfEngine';
import { toProcessingError } from '../../lib/processingErrors';

const MIN_TEXT_CHARS_PER_PAGE = 50;

async function extractPageTextWithPdfJs(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof loadPdfDocument>>['getPage']>>
): Promise<string> {
  const content = await page.getTextContent();
  return content.items
    .map((item) => ('str' in item ? item.str : ''))
    .join(' ')
    .trim();
}

async function extractPageTextWithOcr(
  file: File,
  pageNum: number,
  onStatus: (message: string) => void
): Promise<string> {
  const canvas = await renderPdfPageToCanvas(file, pageNum, 2);
  const { recognize } = await import('tesseract.js');

  const result = await recognize(canvas, 'eng', {
    logger: (m) => {
      if (m.status === 'loading tesseract core' || m.status === 'initializing tesseract') {
        onStatus('Downloading OCR Engine (One-time setup, ~20MB)...');
      } else if (
        m.status === 'loading language traineddata' ||
        m.status === 'initialized api' ||
        m.status === 'initializing api'
      ) {
        onStatus('Downloading OCR Engine (One-time setup, ~20MB)...');
      } else if (m.status === 'recognizing text') {
        onStatus('Analyzing document text...');
      }
    },
  });

  return result.data.text.trim();
}

export default function PdfToTextTool() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [deepScan, setDeepScan] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { report, resetProgress, setProgress } = useToolProgress();

  const extract = useCallback(async () => {
    if (!selectedFile) {
      setError('Please select a PDF.');
      return;
    }
    setBusy(true);
    setError(null);
    setText('');
    setStatusMessage(null);
    setProgress({ active: true, percent: 0, label: 'Reading PDF…' });

    try {
      const pdf = await loadPdfDocument(selectedFile);
      const parts: string[] = [];
      let usedOcr = false;

      for (let p = 1; p <= pdf.numPages; p++) {
        report(p - 1, pdf.numPages, `Processing page ${p} of ${pdf.numPages}…`);
        const page = await pdf.getPage(p);

        let pageText = '';
        if (!deepScan) {
          pageText = await extractPageTextWithPdfJs(page);
        }

        const needsOcr = deepScan || pageText.length < MIN_TEXT_CHARS_PER_PAGE;
        if (needsOcr) {
          usedOcr = true;
          pageText = await extractPageTextWithOcr(selectedFile, p, (msg) => {
            setStatusMessage(msg);
            setProgress({ active: true, label: msg });
          });
        }

        parts.push(`--- Page ${p} ---\n${pageText || '(no text detected)'}`);
        page.cleanup();
      }

      setText(parts.join('\n\n'));
      setStatusMessage(
        usedOcr ? 'Extraction complete (OCR used for scanned or sparse pages).' : 'Extraction complete.'
      );
    } catch (err) {
      setError(toProcessingError(err));
      setStatusMessage(null);
    } finally {
      resetProgress();
      setBusy(false);
    }
  }, [selectedFile, deepScan, report, resetProgress, setProgress]);

  const copyText = useCallback(async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
  }, [text]);

  return (
    <div className="space-y-4">
      <FileDropZone
        accept="application/pdf"
        label="Select PDF to extract text"
        onFiles={(f) => {
          setSelectedFile(f[0] ?? null);
          setError(null);
          setText('');
          setStatusMessage(null);
        }}
      />
      <SelectedFileStatus file={selectedFile} />

      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3">
        <input
          type="checkbox"
          checked={deepScan}
          onChange={(e) => setDeepScan(e.target.checked)}
          className="h-4 w-4 accent-emerald-500"
        />
        <span className="text-sm text-slate-300">
          <span className="font-semibold text-white">Deep Scan (OCR)</span>
          <span className="mt-0.5 block text-xs text-slate-500">
            Force Tesseract OCR on every page — best for scanned documents (~20MB one-time download).
          </span>
        </span>
      </label>

      {statusMessage && (
        <p className="rounded-xl border border-emerald-800/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200" role="status">
          {statusMessage}
        </p>
      )}

      <ActionButton onClick={extract} disabled={busy || !selectedFile}>
        {busy ? 'Extracting…' : 'Extract Text'}
      </ActionButton>
      <StatusMessage error={error} />
      {text && (
        <>
          <textarea
            readOnly
            value={text}
            rows={12}
            className="input-field border-emerald-800/60 bg-slate-950 font-mono text-xs text-white focus:border-emerald-400"
          />
          <ActionButton onClick={copyText}>Copy to Clipboard</ActionButton>
        </>
      )}
    </div>
  );
}
