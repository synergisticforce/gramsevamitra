import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
// @ts-ignore - Bypassing TS for Vite asset URL import
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';

let workerConfigured = false;

/** Resolved pdf.js worker URL via Vite asset pipeline (Cloudflare-safe). */
export function getPdfJsWorkerSrc(): string {
  return pdfWorkerUrl;
}

export function configurePdfJsWorker(): void {
  if (workerConfigured || typeof window === 'undefined') return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  workerConfigured = true;
}

export { pdfjsLib };
