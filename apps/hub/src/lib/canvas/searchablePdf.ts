import { canvasToDataUrl, preprocessForOcr } from '@shared/utils/ocrPreprocess';
import type {
  OcrPageWords,
  TesseractWorkerInbound,
  TesseractWorkerOutbound,
} from '../ocr/tesseractWorkerTypes';
import { isPdfMimeOrName, splitFilenameBase } from './documentPdfTools';

/**
 * Builds a "searchable PDF": the original page image with an invisible text
 * layer positioned over each recognised word. The page looks identical to the
 * scan, but the text can be selected, copied, and found with Ctrl+F in any
 * PDF reader.
 */

export interface SearchablePdfProgress {
  label: string;
  percent: number;
}

/** Render scale for the visible page image. */
const PAGE_SCALE = 2;
const MAX_PAGES = 40;
const JPEG_QUALITY = 0.85;

interface PageRender {
  canvas: HTMLCanvasElement;
}

function loadImage(file: Blob): Promise<HTMLImageElement | ImageBitmap> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() =>
      createImageBitmap(file),
    );
  }
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read this image.'));
    };
    img.src = url;
  });
}

async function renderPages(
  file: File,
  onProgress: (progress: SearchablePdfProgress) => void,
): Promise<PageRender[]> {
  if (isPdfMimeOrName(file.type, file.name)) {
    const { loadPdfDocument, renderPdfPageToCanvas } = await import('../pdf/pdfRender');
    const pdf = await loadPdfDocument(file);
    const total = Math.min(MAX_PAGES, pdf.numPages);
    const pages: PageRender[] = [];

    for (let p = 1; p <= total; p += 1) {
      onProgress({
        label: `Preparing page ${p} of ${total}…`,
        percent: Math.round((p / total) * 25),
      });
      pages.push({ canvas: await renderPdfPageToCanvas(file, p, PAGE_SCALE) });
    }
    return pages;
  }

  const source = await loadImage(file);
  const width = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const height = 'naturalHeight' in source ? source.naturalHeight : source.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This device cannot process images.');
  ctx.drawImage(source, 0, 0);
  if ('close' in source && typeof source.close === 'function') source.close();
  return [{ canvas }];
}

function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the page image.'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

function recognizePages(
  images: string[],
  onProgress: (progress: SearchablePdfProgress) => void,
): Promise<OcrPageWords[]> {
  const id = crypto.randomUUID();
  const worker = new Worker(new URL('../../workers/tesseractOcr.worker.ts', import.meta.url), {
    type: 'module',
  });

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      worker.postMessage({ type: 'terminate' } satisfies TesseractWorkerOutbound);
      worker.terminate();
    };

    const handler = (event: MessageEvent<TesseractWorkerInbound>) => {
      const data = event.data;
      if (data.type === 'progress') {
        const ratio = data.progress ?? 0;
        onProgress({
          label: 'Reading the text on each page…',
          percent: 30 + Math.round(ratio * 45),
        });
      }
      if (data.type === 'done' && data.id === id) {
        worker.removeEventListener('message', handler);
        cleanup();
        resolve(data.pages ?? []);
      }
      if (data.type === 'error' && data.id === id) {
        worker.removeEventListener('message', handler);
        cleanup();
        reject(new Error(data.message));
      }
    };

    worker.addEventListener('message', handler);
    worker.postMessage({
      type: 'recognize',
      id,
      images,
      withBoxes: true,
    } satisfies TesseractWorkerOutbound);
  });
}

/**
 * The invisible layer uses a standard PDF font, which can only encode Latin-1.
 * Devanagari words are dropped from the searchable layer rather than crashing
 * the export — they remain visible in the page image.
 */
function toEncodableText(text: string): string {
  const cleaned = text.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '').trim();
  return cleaned.replace(/[()\\]/g, '');
}

export interface SearchablePdfResult {
  bytes: Uint8Array;
  downloadName: string;
  pageCount: number;
  wordCount: number;
  /** True when some words could not be added to the searchable layer. */
  partialLanguageSupport: boolean;
}

export async function buildSearchablePdf(
  file: File,
  onProgress: (progress: SearchablePdfProgress) => void,
): Promise<SearchablePdfResult> {
  onProgress({ label: 'Opening your document…', percent: 4 });
  const pages = await renderPages(file, onProgress);
  if (pages.length === 0) {
    throw new Error('This document has no pages to process.');
  }

  onProgress({ label: 'Enhancing pages for text recognition…', percent: 27 });
  const ocrImages: string[] = [];
  for (const page of pages) {
    const processed = preprocessForOcr(page.canvas, { contrast: 1.8, binarize: true });
    ocrImages.push(await canvasToDataUrl(processed));
  }

  const recognised = await recognizePages(ocrImages, onProgress);

  onProgress({ label: 'Building searchable PDF…', percent: 80 });
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  let wordCount = 0;
  let skipped = 0;

  for (let index = 0; index < pages.length; index += 1) {
    const canvas = pages[index].canvas;
    const jpeg = await canvasToJpegBlob(canvas);
    const image = await pdf.embedJpg(await jpeg.arrayBuffer());

    const pageWidth = canvas.width / PAGE_SCALE;
    const pageHeight = canvas.height / PAGE_SCALE;
    const pdfPage = pdf.addPage([pageWidth, pageHeight]);
    pdfPage.drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight });

    const pageWords = recognised.find((entry) => entry.page === index);
    if (!pageWords || pageWords.words.length === 0) continue;

    // OCR ran on the preprocessed canvas, which shares the rendered canvas
    // dimensions, so map pixel boxes straight onto PDF points.
    const scaleX = pageWidth / (pageWords.width || canvas.width);
    const scaleY = pageHeight / (pageWords.height || canvas.height);

    for (const word of pageWords.words) {
      if (word.confidence < 40) continue;
      const text = toEncodableText(word.text);
      if (!text) {
        skipped += 1;
        continue;
      }

      const boxHeight = (word.y1 - word.y0) * scaleY;
      const boxWidth = (word.x1 - word.x0) * scaleX;
      if (boxHeight <= 0 || boxWidth <= 0) continue;

      let size = Math.max(1, Math.min(boxHeight * 0.85, 72));
      let width: number;
      try {
        width = font.widthOfTextAtSize(text, size);
      } catch {
        skipped += 1;
        continue;
      }

      // Shrink to the detected box width so selection highlights line up with
      // what the reader sees instead of overflowing the next word.
      if (width > boxWidth && width > 0) {
        size = Math.max(1, size * (boxWidth / width));
      }

      try {
        pdfPage.drawText(text, {
          x: word.x0 * scaleX,
          // Canvas measures from the top; PDF measures from the bottom.
          y: pageHeight - word.y1 * scaleY + boxHeight * 0.18,
          size,
          font,
          color: rgb(0, 0, 0),
          opacity: 0,
        });
        wordCount += 1;
      } catch {
        skipped += 1;
      }
    }
  }

  onProgress({ label: 'Saving…', percent: 96 });
  const bytes = await pdf.save();
  const baseName = splitFilenameBase(file.name);

  return {
    bytes,
    downloadName: `${baseName}-searchable.pdf`,
    pageCount: pages.length,
    wordCount,
    partialLanguageSupport: skipped > 0,
  };
}
