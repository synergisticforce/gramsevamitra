import {
  OCR_MAX_OUTPUT_PAGES,
  OCR_TIER1_MAX_SAMPLE_PAGES,
  OCR_WATERFALL_LOADER_STAGES,
  tier1NeedsProHandoff,
} from '@shared/utils/ocrQuality';
import {
  canvasToDataUrl,
  imageToCanvas,
  preprocessForOcr,
} from '@shared/utils/ocrPreprocess';
import { isImageMimeOrName, isPdfMimeOrName } from '../canvas/documentPdfTools';
import { disposeTesseractWorker, type Tier1OcrResult } from '../ocr/tesseractTier1';
import type { TesseractWorkerInbound, TesseractWorkerOutbound } from '../ocr/tesseractWorkerTypes';

export type { Tier1OcrResult };

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load image.'));
    };
    img.src = url;
  });
}

interface CollectedPages {
  images: string[];
  totalPages: number;
  /** True when the document was longer than the page budget. */
  truncated: boolean;
}

async function collectPreprocessedImages(
  file: File,
  maxPages: number,
  onProgress?: (label: string, percent: number) => void,
): Promise<CollectedPages> {
  const images: string[] = [];

  if (isPdfMimeOrName(file.type, file.name)) {
    const { loadPdfDocument, renderPdfPageToCanvas } = await import('../pdf/pdfRender');
    const pdf = await loadPdfDocument(file);
    const pages = Math.min(maxPages, pdf.numPages);

    for (let p = 1; p <= pages; p += 1) {
      onProgress?.(
        pages > 1 ? `Reading page ${p} of ${pages}…` : OCR_WATERFALL_LOADER_STAGES.tier1,
        Math.round(((p - 1) / pages) * 35),
      );
      const canvas = await renderPdfPageToCanvas(file, p, 1.5);
      const processed = preprocessForOcr(canvas, { contrast: 1.8, binarize: true });
      images.push(await canvasToDataUrl(processed));
    }
    return { images, totalPages: pdf.numPages, truncated: pdf.numPages > pages };
  }

  if (isImageMimeOrName(file.type, file.name)) {
    onProgress?.(OCR_WATERFALL_LOADER_STAGES.tier1, 10);
    const img = await loadImageFromFile(file);
    const canvas = imageToCanvas(img, 1600);
    const processed = preprocessForOcr(canvas, { contrast: 1.8, binarize: true });
    images.push(await canvasToDataUrl(processed));
    return { images, totalPages: 1, truncated: false };
  }

  throw new Error('OCR supports PDF and image files only.');
}

function spawnFreshWorker(): Worker {
  return new Worker(new URL('../../workers/tesseractOcr.worker.ts', import.meta.url), {
    type: 'module',
  });
}

function recognizeWithFreshWorker(
  images: string[],
  onProgress?: (label: string, percent: number) => void,
): Promise<Tier1OcrResult> {
  const id = crypto.randomUUID();
  const worker = spawnFreshWorker();

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      worker.postMessage({ type: 'terminate' } satisfies TesseractWorkerOutbound);
      worker.terminate();
    };

    const handler = (event: MessageEvent<TesseractWorkerInbound>) => {
      const data = event.data;
      if (data.type === 'progress') {
        onProgress?.(data.status ?? OCR_WATERFALL_LOADER_STAGES.tier1, Math.round((data.progress ?? 0) * 100));
      }
      if (data.type === 'done' && data.id === id) {
        worker.removeEventListener('message', handler);
        cleanup();
        resolve({
          text: data.text,
          averageConfidence: data.averageConfidence,
          pagesSampled: data.pagesSampled,
          words: data.words,
          needsProHandoff: tier1NeedsProHandoff(data.text, data.averageConfidence),
        });
      }
      if (data.type === 'error' && data.id === id) {
        worker.removeEventListener('message', handler);
        cleanup();
        reject(new Error(data.message));
      }
    };

    worker.addEventListener('message', handler);
    worker.postMessage({ type: 'recognize', id, images } satisfies TesseractWorkerOutbound);
  });
}

export interface TesseractRunOptions {
  /**
   * `sample` reads only the first pages to judge scan quality.
   * `output` reads the whole document because the text becomes a real file.
   */
  mode?: 'sample' | 'output';
  onTruncated?: (readPages: number, totalPages: number) => void;
}

/** Run Tesseract with eng+hin, then terminate the worker to flush WASM RAM. */
export async function runTesseractWithMemoryFlush(
  file: File,
  onProgress?: (label: string, percent: number) => void,
  options: TesseractRunOptions = {},
): Promise<Tier1OcrResult> {
  const { mode = 'output', onTruncated } = options;
  const maxPages = mode === 'sample' ? OCR_TIER1_MAX_SAMPLE_PAGES : OCR_MAX_OUTPUT_PAGES;

  onProgress?.(OCR_WATERFALL_LOADER_STAGES.tier1, 2);
  try {
    const { images, totalPages, truncated } = await collectPreprocessedImages(
      file,
      maxPages,
      onProgress,
    );
    if (truncated) {
      onTruncated?.(images.length, totalPages);
    }
    onProgress?.(OCR_WATERFALL_LOADER_STAGES.tier1, 40);
    return await recognizeWithFreshWorker(images, onProgress);
  } finally {
    disposeTesseractWorker();
  }
}
