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
