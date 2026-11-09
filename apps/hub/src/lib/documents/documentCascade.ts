import { apiUrl } from '../../shared/lib/apiBase';
import { isImageMimeOrName, isPdfMimeOrName } from '../canvas/documentPdfTools';
import type { EditableFormatTarget, ToEditableFormatProgress } from '../services/toEditableFormatPipeline';
import { runTesseractWithMemoryFlush } from '../services/tesseractWrapper';
import { getTurnstileToken } from '../auth/turnstileClient';
import {
  passesDocumentConfidenceGate,
  passesTableAlignmentGate,
  wordsToGrid,
} from './browserOcrGate';
import { readDigitalPdfGrid } from './digitalPdfConverter';
import { downloadEditableGrid, gridToPlainText, type EditableExportFormat } from './editableExport';
import type { OcrWordBox } from '../ocr/tesseractWorkerTypes';

const LOCAL_FORMATS = new Set<EditableFormatTarget>(['txt', 'md', 'docx', 'csv', 'xlsx']);

function isTableFormat(target: EditableFormatTarget): boolean {
  return target === 'xlsx' || target === 'csv';
}

function linesToGrid(text: string): string[][] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => [line]);
}

export async function tryDocumentCascade(
  file: File,
  target: EditableFormatTarget,
  onProgress: (progress: ToEditableFormatProgress) => void,
): Promise<{ path: 'A' | 'B' | 'C'; fileName: string; notice: string } | null> {
  if (!LOCAL_FORMATS.has(target)) return null;
  if (!isPdfMimeOrName(file.type, file.name) && !isImageMimeOrName(file.type, file.name)) return null;

  const format = target as EditableExportFormat;
  let needsOcr = isImageMimeOrName(file.type, file.name);

  if (isPdfMimeOrName(file.type, file.name)) {
    onProgress({ label: 'Checking the digital text layer…', percent: 8 });
    const digital = await readDigitalPdfGrid(file);
    if (digital && digital !== 'CORRUPTED_DIGITAL') {
      onProgress({ label: 'Building the file on this device…', percent: 82 });
      const fileName = await downloadEditableGrid(digital.rows, format, file.name);
      const truncated = digital.pagesRead < digital.pageCount ? ` First ${digital.pagesRead} pages.` : '';
      return {
        path: 'A',
        fileName,
        notice: `Converted 100% on your device from the digital text layer. ₹0 charged.${truncated}`,
      };
    }
    needsOcr = true;
    if (digital === 'CORRUPTED_DIGITAL') {
      onProgress({
        label: 'The embedded font is not readable. Switching to scan OCR…',
        percent: 18,
      });
    }
  }

  if (!needsOcr) return null;

  onProgress({ label: 'Reading the scan on this device…', percent: 24 });
  const ocr = await runTesseractWithMemoryFlush(
    file,
    (label, percent) => onProgress({ label, percent: Math.max(24, Math.min(70, percent)) }),
    { mode: 'output', withBoxes: true },
  );
  const boxes: OcrWordBox[] = (ocr.pages ?? []).flatMap((page) => page.words);
  const gateWords = boxes.length ? boxes : ocr.words;
  const passed = isTableFormat(target)
    ? passesTableAlignmentGate(boxes)
    : passesDocumentConfidenceGate({ meanConfidence: ocr.averageConfidence, words: gateWords });

  if (passed) {
    const rows = boxes.length ? wordsToGrid(boxes) : linesToGrid(ocr.text);
    onProgress({ label: 'Building the file on this device…', percent: 88 });
    const fileName = await downloadEditableGrid(rows, format, file.name);
    return {
      path: 'B',
      fileName,
      notice: `Converted 100% on your device (Confidence: ${ocr.averageConfidence.toFixed(1)}% ≥ 95% · ₹0 charged).`,
    };
  }

  onProgress({
    label: `Scan confidence is ${ocr.averageConfidence.toFixed(1)}% (below 95%). Asking the high-precision reader…`,
    percent: 74,
    subtitle: 'Two cloud pages per month are free. The file is sent only for this step.',
  });

  const token = await getTurnstileToken();
  const body = new FormData();
  body.append('file', file, file.name);
  body.append('outputFormat', format);
  body.append('meanConfidence', String(ocr.averageConfidence));
  if (token) body.append('cf-turnstile-response', token);

  const response = await fetch(apiUrl('/api/pro/document-smart-convert'), {
    method: 'POST',
    credentials: 'include',
    body,
  });
  const payload = (await response.json()) as {
    success?: boolean;
    rows?: string[][];
    text?: string;
    message?: string;
    error?: string;
  };
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || payload.error || 'High-precision conversion is unavailable. No credits were deducted.');
  }
  const rows = payload.rows?.length ? payload.rows : linesToGrid(payload.text || gridToPlainText([]));
  if (!rows.length) {
    throw new Error('The high-precision reader returned no text. No credits were deducted.');
  }
  onProgress({ label: 'Building the file on this device…', percent: 92 });
  const fileName = await downloadEditableGrid(rows, format, file.name);
  return {
    path: 'C',
    fileName,
    notice: payload.message || 'Converted with the high-precision reader after the on-device confidence check.',
  };
}
