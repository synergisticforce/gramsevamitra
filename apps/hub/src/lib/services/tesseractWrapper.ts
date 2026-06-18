import { OCR_TIER1_MAX_SAMPLE_PAGES, OCR_WATERFALL_LOADER_STAGES, tier1NeedsProHandoff } from '@shared/utils/ocrQuality';
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

async function collectPreprocessedImages(
  file: File,
  onProgress?: (label: string, percent: number) => void,
): Promise<string[]> {
  const images: string[] = [];

  if (isPdfMimeOrName(file.type, file.name)) {
    const { loadPdfDocument, renderPdfPageToCanvas } = await import('../pdf/pdfRender');
    const pdf = await loadPdfDocument(file);
    const pages = Math.min(OCR_TIER1_MAX_SAMPLE_PAGES, pdf.numPages);

    for (let p = 1; p <= pages; p += 1) {
      onProgress?.(
        OCR_WATERFALL_LOADER_STAGES.tier1,
        Math.round(((p - 1) / pages) * 35),
      );
      const canvas = await renderPdfPageToCanvas(file, p, 1.5);
      const processed = preprocessForOcr(canvas, { contrast: 1.8, binarize: true });
      images.push(await canvasToDataUrl(processed));
    }
    return images;
  }

  if (isImageMimeOrName(file.type, file.name)) {
    onProgress?.(OCR_WATERFALL_LOADER_STAGES.tier1, 10);
    const img = await loadImageFromFile(file);
    const canvas = imageToCanvas(img, 1600);
    const processed = preprocessForOcr(canvas, { contrast: 1.8, binarize: true });
    images.push(await canvasToDataUrl(processed));
    return images;
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

/** Run Tesseract with eng+hin, then terminate the worker to flush WASM RAM. */
export async function runTesseractWithMemoryFlush(
  file: File,
  onProgress?: (label: string, percent: number) => void,
): Promise<Tier1OcrResult> {
  onProgress?.(OCR_WATERFALL_LOADER_STAGES.tier1, 2);
  try {
    const images = await collectPreprocessedImages(file, onProgress);
    onProgress?.(OCR_WATERFALL_LOADER_STAGES.tier1, 40);
    return await recognizeWithFreshWorker(images, onProgress);
  } finally {
    disposeTesseractWorker();
  }
}
