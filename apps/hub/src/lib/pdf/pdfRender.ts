import type { PDFDocumentProxy } from 'pdfjs-dist';
import { configurePdfJsWorker, pdfjsLib } from './pdfJsWorker';

export async function loadPdfDocument(file: File): Promise<PDFDocumentProxy> {
  configurePdfJsWorker();
  const data = new Uint8Array(await file.arrayBuffer());
  return pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalSupported: false }).promise;
}

export async function renderPdfPageToCanvas(
  file: File,
  pageNumber: number,
  scale = 1
): Promise<HTMLCanvasElement> {
  const pdf = await loadPdfDocument(file);
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
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
  return canvas;
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

export async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas export failed'))),
      'image/png'
    );
  });
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
