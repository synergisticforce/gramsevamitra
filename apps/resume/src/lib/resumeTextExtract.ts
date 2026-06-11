import { configurePdfJsWorker, pdfjsLib } from './pdfJsWorker';

const MIN_PDF_TEXT_CHARS = 100;

export type StatusCallback = (message: string) => void;

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function isDocxFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  );
}

function isImageFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type.startsWith('image/') ||
    /\.(jpe?g|png|heic|heif|webp)$/i.test(name)
  );
}

async function extractPdfFastText(
  arrayBuffer: ArrayBuffer,
  onStatus: StatusCallback
): Promise<string> {
  configurePdfJsWorker();
  const pdf = await pdfjsLib
    .getDocument({ data: arrayBuffer, useWorkerFetch: false, isEvalSupported: false })
    .promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    onStatus(`Reading digital text... (page ${i} of ${pdf.numPages})`);
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .trim();
    pages.push(pageText);
    page.cleanup();
  }

  return pages.join('\n\n');
}

async function renderPdfPageToCanvas(
  arrayBuffer: ArrayBuffer,
  pageNum: number,
  scale = 2
): Promise<HTMLCanvasElement> {
  configurePdfJsWorker();
  const pdf = await pdfjsLib
    .getDocument({ data: arrayBuffer, useWorkerFetch: false, isEvalSupported: false })
    .promise;
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  await page.render({ canvasContext: ctx, viewport }).promise;
  page.cleanup();
  return canvas;
}

async function ocrCanvas(
  canvas: HTMLCanvasElement,
  onStatus: StatusCallback
): Promise<string> {
  const { recognize } = await import('tesseract.js');
  const result = await recognize(canvas, 'eng', {
    logger: (m) => {
      if (
        m.status === 'loading tesseract core' ||
        m.status === 'initializing tesseract' ||
        m.status === 'loading language traineddata' ||
        m.status === 'initialized api' ||
        m.status === 'initializing api'
      ) {
        onStatus('Downloading OCR Engine (One-time setup, ~20MB)...');
      } else if (m.status === 'recognizing text') {
        onStatus('Deep scanning document (OCR)...');
      }
    },
  });
  return result.data.text.trim();
}

async function extractPdfWithOcr(file: File, onStatus: StatusCallback): Promise<string> {
  const buffer = await file.arrayBuffer();
  configurePdfJsWorker();
  const pdf = await pdfjsLib
    .getDocument({ data: buffer, useWorkerFetch: false, isEvalSupported: false })
    .promise;

  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    onStatus(`Deep scanning document (OCR)... (page ${i} of ${pdf.numPages})`);
    const canvas = await renderPdfPageToCanvas(buffer, i, 2);
    const text = await ocrCanvas(canvas, onStatus);
    parts.push(text);
  }
  return parts.join('\n\n');
}

async function fileToOcrCanvas(file: File): Promise<HTMLCanvasElement> {
  const name = file.name.toLowerCase();
  const isHeic =
    file.type.includes('heic') ||
    file.type.includes('heif') ||
    name.endsWith('.heic') ||
    name.endsWith('.heif');

  if (isHeic && typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    return canvas;
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Failed to load image'));
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');
    ctx.drawImage(img, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function extractImageWithOcr(file: File, onStatus: StatusCallback): Promise<string> {
  onStatus('Deep scanning document (OCR)...');
  const canvas = await fileToOcrCanvas(file);
  return ocrCanvas(canvas, onStatus);
}

async function extractDocxText(file: File, onStatus: StatusCallback): Promise<string> {
  onStatus('Reading digital text...');
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value.trim();
}

/** Hybrid résumé text extraction — PDF fast path, Tesseract OCR fallback, images, DOCX. */
export async function extractResumeText(file: File, onStatus: StatusCallback): Promise<string> {
  if (isPdfFile(file)) {
    onStatus('Reading digital text...');
    const buffer = await file.arrayBuffer();
    const fastText = await extractPdfFastText(buffer, onStatus);
    if (fastText.trim().length >= MIN_PDF_TEXT_CHARS) {
      return fastText;
    }
    return extractPdfWithOcr(file, onStatus);
  }

  if (isImageFile(file)) {
    return extractImageWithOcr(file, onStatus);
  }

  if (isDocxFile(file)) {
    return extractDocxText(file, onStatus);
  }

  throw new Error('Unsupported file format. Upload PDF, DOCX, JPG, PNG, or HEIC.');
}

export function isSupportedResumeFile(file: File): boolean {
  return isPdfFile(file) || isDocxFile(file) || isImageFile(file);
}
