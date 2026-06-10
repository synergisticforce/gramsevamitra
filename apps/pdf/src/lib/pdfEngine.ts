import type { PDFDocumentProxy } from 'pdfjs-dist';
import { downloadBlob as brandedDownloadBlob } from '@shared/utils/fileUtils';
import { configurePdfJsWorker, pdfjsLib } from './pdfJsWorker';

export const THUMBNAIL_RENDER_SCALE = 0.45;

export async function initPdfJs(): Promise<void> {
  configurePdfJsWorker();
}

export async function loadPdfDocument(file: File): Promise<PDFDocumentProxy> {
  await initPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  return pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalSupported: false }).promise;
}

export async function renderPdfPageOnCanvas(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale = THUMBNAIL_RENDER_SCALE
): Promise<void> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  const task = page.render({ canvasContext: ctx, viewport });
  try {
    await task.promise;
  } finally {
    page.cleanup();
  }
}

export function releaseCanvas(canvas: HTMLCanvasElement | null): void {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx?.clearRect(0, 0, canvas.width, canvas.height);
  canvas.width = 0;
  canvas.height = 0;
}

export function downloadBlob(blob: Blob, filename: string, toolSuffix = ''): void {
  brandedDownloadBlob(blob, filename, toolSuffix);
}

export function downloadBytes(bytes: Uint8Array, filename: string, mime: string, toolSuffix = ''): void {
  const copy = new Uint8Array(bytes);
  downloadBlob(new Blob([copy], { type: mime }), filename, toolSuffix);
}

export async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

export async function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas export failed'))),
      'image/jpeg',
      quality
    );
  });
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function renderPdfPageToCanvas(
  file: File,
  pageNumber: number,
  scale = 1.5
): Promise<HTMLCanvasElement> {
  const pdf = await loadPdfDocument(file);
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

export function applyScannerEffect(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.drawImage(canvas, 0, 0);
  const imageData = ctx.getImageData(0, 0, out.width, out.height);
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const contrast = Math.min(255, Math.max(0, (gray - 128) * 1.4 + 128));
    const boosted = contrast > 175 ? 255 : contrast < 90 ? 0 : contrast;
    data[i] = boosted;
    data[i + 1] = boosted;
    data[i + 2] = boosted;
  }

  ctx.putImageData(imageData, 0, 0);
  return out;
}

export function rotateCanvas(canvas: HTMLCanvasElement, degrees: number): HTMLCanvasElement {
  const rad = (degrees * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const out = document.createElement('canvas');
  out.width = canvas.width * cos + canvas.height * sin;
  out.height = canvas.width * sin + canvas.height * cos;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return out;
}
