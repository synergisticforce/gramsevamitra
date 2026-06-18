import {
  canvasToDataUrl,
  imageToCanvas,
  preprocessForOcr,
} from '@shared/utils/ocrPreprocess';
import {
  OCR_TIER1_MAX_SAMPLE_PAGES,
  OCR_WATERFALL_LOADER_STAGES,
  tier1NeedsProHandoff,
} from '@shared/utils/ocrQuality';
import { isImageMimeOrName, isPdfMimeOrName } from '../canvas/documentPdfTools';
import type { TesseractWorkerInbound, TesseractWorkerOutbound } from './tesseractWorkerTypes';

export interface Tier1OcrResult {
  text: string;
  averageConfidence: number;
  pagesSampled: number;
  needsProHandoff: boolean;
  words: Array<{ text: string; confidence: number }>;
}

let worker: Worker | null = null;

function getTesseractWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../../workers/tesseractOcr.worker.ts', import.meta.url), {
      type: 'module',
    });
  }
  return worker;
}

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

  throw new Error('Tier 1 OCR supports PDF and image files only.');
}

function recognizeWithWorker(images: string[]): Promise<Tier1OcrResult> {
  const id = crypto.randomUUID();
  const w = getTesseractWorker();

  return new Promise((resolve, reject) => {
    const handler = (event: MessageEvent<TesseractWorkerInbound>) => {
      const data = event.data;
      if (data.type === 'done' && data.id === id) {
        w.removeEventListener('message', handler);
        const result: Tier1OcrResult = {
          text: data.text,
          averageConfidence: data.averageConfidence,
          pagesSampled: data.pagesSampled,
          words: data.words,
          needsProHandoff: tier1NeedsProHandoff(data.text, data.averageConfidence),
        };
        resolve(result);
      }
      if (data.type === 'error' && data.id === id) {
        w.removeEventListener('message', handler);
        reject(new Error(data.message));
      }
    };

    w.addEventListener('message', handler);
    w.postMessage({ type: 'recognize', id, images } satisfies TesseractWorkerOutbound);
  });
}

export async function runTier1TesseractOcr(
  file: File,
  onProgress?: (label: string, percent: number) => void,
): Promise<Tier1OcrResult> {
  onProgress?.(OCR_WATERFALL_LOADER_STAGES.tier1, 2);
  const images = await collectPreprocessedImages(file, onProgress);
  onProgress?.(OCR_WATERFALL_LOADER_STAGES.tier1, 40);
  const result = await recognizeWithWorker(images);
  onProgress?.(OCR_WATERFALL_LOADER_STAGES.tier1, 100);
  return result;
}

export function disposeTesseractWorker(): void {
  if (!worker) return;
  worker.postMessage({ type: 'terminate' } satisfies TesseractWorkerOutbound);
  worker.terminate();
  worker = null;
}
