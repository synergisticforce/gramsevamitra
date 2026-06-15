import { PDFDocument } from 'pdf-lib';
import { isPdfMimeOrName } from './documentPdfTools';

export const SMART_EXTRACT_LARGE_PDF_BYTES = 5 * 1024 * 1024;
const MIN_TEXT_CHARS_FOR_TEXT_MODE = 200;
const MAX_SHIELD_PAGES = 20;

export interface SmartExtractPrepProgress {
  label: string;
  percent: number;
}

export type SmartExtractUploadPlan =
  | { mode: 'text'; extractedText: string; fileName: string }
  | { mode: 'upload'; file: File; shieldApplied?: boolean };

function isPdfFile(file: File): boolean {
  return isPdfMimeOrName(file.type, file.name);
}

/** Shrink large PDFs to the first N pages using pdf-lib (RAM Shield fallback). */
async function shrinkPdfToPageCap(file: File, maxPages: number): Promise<File> {
  const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  const dst = await PDFDocument.create();
  const pageCount = Math.min(maxPages, src.getPageCount());
  if (pageCount === 0) {
    throw new Error('PDF has no pages to process.');
  }
  const indices = Array.from({ length: pageCount }, (_, index) => index);
  const copied = await dst.copyPages(src, indices);
  copied.forEach((page) => dst.addPage(page));
  const bytes = await dst.save();
  const baseName = file.name.replace(/\.pdf$/i, '') || 'document';
  return new File([bytes], `${baseName}_subset.pdf`, { type: 'application/pdf' });
}

/**
 * RAM Shield — for PDFs over 5MB prefer local text extraction (pdf.js) for /api/pro/extract.
 * Falls back to a pdf-lib page subset upload when text is unavailable (scanned PDFs).
 */
export async function prepareSmartExtractUpload(
  file: File,
  onProgress: (progress: SmartExtractPrepProgress) => void,
): Promise<SmartExtractUploadPlan> {
  if (!isPdfFile(file) || file.size <= SMART_EXTRACT_LARGE_PDF_BYTES) {
    return { mode: 'upload', file };
  }

  onProgress({
    label: 'Preparing your document for fast, secure processing…',
    percent: 10,
  });

  try {
    const { extractTextFromPdfFile } = await import('./careerPdfText');
    const extractedText = await extractTextFromPdfFile(file, (current, total) => {
      const percent = 10 + Math.round((current / total) * 25);
      onProgress({
        label: `Reading page ${current} of ${total} locally…`,
        percent,
      });
    });

    if (extractedText.length >= MIN_TEXT_CHARS_FOR_TEXT_MODE) {
      onProgress({ label: 'Document ready for advanced AI extraction.', percent: 38 });
      return { mode: 'text', extractedText, fileName: file.name };
    }
  } catch {
    /* fall through to pdf-lib subset */
  }

  onProgress({
    label: 'Optimizing a lightweight copy of your document…',
    percent: 28,
  });

  const subset = await shrinkPdfToPageCap(file, MAX_SHIELD_PAGES);
  onProgress({ label: 'Document ready for secure upload.', percent: 38 });
  return { mode: 'upload', file: subset, shieldApplied: true };
}
