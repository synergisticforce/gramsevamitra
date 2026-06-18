import { formatFileSize } from './documentCanvasStorage';
import { downloadPdfBytes } from '../pdf/downloadPdf';
import { normalizedCropToPdfBox, type NormalizedCropRect } from '../pdf/cropCoords';
import type {
  OverlayPosition,
  PageNumberFormat,
  PageNumberHorizontal,
  PageNumberVertical,
} from '../pdf/pdfOverlay';
import { formatUnlockError } from '../pdf/pdfEncryption';
import { parsePageRange } from '../pdf/pageRangeParser';
import type { PdfWorkerProgress } from '../pdf/pdfWorkerClient';
import { buildPageExportFilename, downloadBlob } from '@shared/utils/fileUtils';

export function isPdfMimeOrName(type: string, name: string): boolean {
  return type === 'application/pdf' || name.toLowerCase().endsWith('.pdf');
}

export function isImageMimeOrName(type: string, name: string): boolean {
  if (type.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp)$/i.test(name);
}

const MIN_EMBEDDED_TEXT_CHARS = 200;

/** True when a PDF has little or no selectable text layer (likely a scan). */
export function isPdfEmbeddedTextThin(extractedText: string, pageCount: number): boolean {
  const stripped = extractedText
    .replace(/--- Page \d+ ---/g, '')
    .replace(/\(no text detected\)/gi, '')
    .replace(/\s+/g, '')
    .trim();
  if (stripped.length >= MIN_EMBEDDED_TEXT_CHARS) return false;
  const noTextPages = extractedText.match(/\(no text detected\)/gi)?.length ?? 0;
  if (pageCount > 0 && noTextPages >= Math.ceil(pageCount * 0.5)) return true;
  return stripped.length < 50;
}

export function splitFilenameBase(name: string): string {
  return name.replace(/\.pdf$/i, '') || 'document';
}

export function splitImageFilenameBase(name: string): string {
  return name.replace(/\.(jpe?g|png|webp)$/i, '') || 'photo';
}

export type CompressionPreset = 'high-quality' | 'balanced' | 'extreme';

export const COMPRESSION_PRESETS: Record<
  CompressionPreset,
  {
    label: string;
    description: string;
    mode: 'metadata' | 'jpeg';
    quality?: number;
    scale?: number;
    postStrip?: boolean;
  }
> = {
  'high-quality': {
    label: 'High Quality',
    description: 'Strips metadata and revision bloat while keeping full resolution.',
    mode: 'metadata',
  },
  balanced: {
    label: 'Balanced',
    description: 'Moderate JPEG re-encode — recommended for most uploads.',
    mode: 'jpeg',
    quality: 0.65,
    scale: 0.85,
  },
  extreme: {
    label: 'Extreme',
    description: 'Aggressive downscaling and JPEG compression for the smallest file size.',
    mode: 'jpeg',
    quality: 0.42,
    scale: 0.7,
    postStrip: true,
  },
};

export interface ProtectPdfOptions {
  userPassword: string;
  ownerPassword?: string;
}

export async function splitPdfInBrowser(
  file: File,
  rangeInput: string,
  pageCount: number,
  onProgress?: (progress: PdfWorkerProgress) => void
): Promise<{ bytes: Uint8Array; pageIndices: number[]; downloadName: string }> {
  const pageIndices = parsePageRange(rangeInput, pageCount);
  const { runPdfWorkerWithStreamedFile } = await import('../pdf/pdfWorkerClient');

  const bytes = await runPdfWorkerWithStreamedFile<Uint8Array>(
    'extract',
    file,
    { pageIndices },
    onProgress
  );

  const baseName = splitFilenameBase(file.name);
  const downloadName = `${baseName}-pages-${rangeInput.replace(/\s+/g, '')}.pdf`;

  return { bytes, pageIndices, downloadName };
}

export async function mergePdfsInBrowser(
  filesInOrder: File[],
  onProgress?: (progress: PdfWorkerProgress) => void
): Promise<{ bytes: Uint8Array; downloadName: string }> {
  if (filesInOrder.length < 2) {
    throw new Error('Add at least one more PDF to merge with the canvas file.');
  }

  const { runPdfWorker } = await import('../pdf/pdfWorkerClient');
  const buffers: ArrayBuffer[] = [];

  for (let i = 0; i < filesInOrder.length; i++) {
    onProgress?.({
      current: i,
      total: filesInOrder.length,
      label: `Reading file ${i + 1} of ${filesInOrder.length}…`,
    });
    buffers.push(await filesInOrder[i].arrayBuffer());
  }

  const bytes = await runPdfWorker<Uint8Array>('merge', { buffers }, onProgress);
  const baseName = splitFilenameBase(filesInOrder[0].name);
  const downloadName = `${baseName}-merged.pdf`;

  return { bytes, downloadName };
}

async function compressWithJpegPreset(
  file: File,
  quality: number,
  scale: number,
  onProgress?: (progress: PdfWorkerProgress) => void
): Promise<Uint8Array> {
  const { loadPdfDocument, renderPdfPageToCanvas, canvasToJpegBlob } = await import(
    '../pdf/pdfRender'
  );
  const { runPdfWorkerWithJpegPages } = await import('../pdf/pdfWorkerClient');

  const pdf = await loadPdfDocument(file);
  return runPdfWorkerWithJpegPages<Uint8Array>(
    pdf.numPages,
    async (pageIndex) => {
      const pageNum = pageIndex + 1;
      onProgress?.({
        current: pageIndex,
        total: pdf.numPages,
        label: `Rendering page ${pageNum} of ${pdf.numPages}…`,
      });
      const canvas = await renderPdfPageToCanvas(file, pageNum, scale);
      const jpeg = await canvasToJpegBlob(canvas, quality);
      return new Uint8Array(await jpeg.arrayBuffer());
    },
    onProgress
  );
}

export async function compressPdfInBrowser(
  file: File,
  preset: CompressionPreset,
  onProgress?: (progress: PdfWorkerProgress) => void
): Promise<{ bytes: Uint8Array; downloadName: string; savingsLabel: string }> {
  const config = COMPRESSION_PRESETS[preset];
  const originalBytes = file.size;
  let bytes: Uint8Array;

  if (config.mode === 'metadata') {
    const { runPdfWorkerWithStreamedFile } = await import('../pdf/pdfWorkerClient');
    bytes = await runPdfWorkerWithStreamedFile<Uint8Array>('strip-metadata', file, {}, onProgress);
  } else {
    bytes = await compressWithJpegPreset(file, config.quality!, config.scale!, onProgress);

    if (config.postStrip) {
      const { runPdfWorker } = await import('../pdf/pdfWorkerClient');
      onProgress?.({ current: 0, total: 1, label: 'Stripping leftover metadata…' });
      bytes = await runPdfWorker<Uint8Array>(
        'strip-metadata',
        { buffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) },
        onProgress
      );
    }
  }

  const outputBytes = bytes.length;
  const saved = Math.max(0, originalBytes - outputBytes);
  const savedPct =
    originalBytes > 0 ? Math.round((saved / originalBytes) * 100) : 0;
  const savingsLabel = `${formatFileSize(originalBytes)} → ${formatFileSize(outputBytes)} · saved ${formatFileSize(saved)} (${savedPct}%)`;

  const baseName = splitFilenameBase(file.name);
  return { bytes, downloadName: `${baseName}-compressed.pdf`, savingsLabel };
}

export async function protectPdfInBrowser(
  file: File,
  options: ProtectPdfOptions,
  onProgress?: (progress: PdfWorkerProgress) => void
): Promise<{ bytes: Uint8Array; downloadName: string }> {
  const { runPdfWorkerWithStreamedFile } = await import('../pdf/pdfWorkerClient');

  const bytes = await runPdfWorkerWithStreamedFile<Uint8Array>(
    'protect-pdf',
    file,
    {
      userPassword: options.userPassword,
      ownerPassword: options.ownerPassword || options.userPassword,
      restrictions: {
        disablePrinting: false,
        disableCopying: true,
        disableModifying: true,
        disableAnnotating: true,
      },
    },
    onProgress
  );

  const baseName = splitFilenameBase(file.name);
  return { bytes, downloadName: `${baseName}-protected.pdf` };
}

export async function unlockPdfInBrowser(
  file: File,
  password: string,
  onProgress?: (progress: PdfWorkerProgress) => void
): Promise<{ bytes: Uint8Array; downloadName: string }> {
  const { runPdfWorkerWithStreamedFile } = await import('../pdf/pdfWorkerClient');

  try {
    const bytes = await runPdfWorkerWithStreamedFile<Uint8Array>(
      'unlock-pdf',
      file,
      { password },
      onProgress
    );
    const baseName = splitFilenameBase(file.name);
    return { bytes, downloadName: `${baseName}-unlocked.pdf` };
  } catch (err) {
    throw new Error(formatUnlockError(err));
  }
}

export function triggerPdfDownload(
  bytes: Uint8Array,
  filename: string,
  toolSuffix:
    | '_merged'
    | '_extracted'
    | '_compressed'
    | '_protected'
    | '_unlocked'
    | '_straightened'
    | '_pages-removed'
    | '_numbered'
    | '_cropped'
    | '_converted'
    | '_typed'
    | '_rotated'
    | '_reordered'
    | '_watermarked'
): void {
  downloadPdfBytes(bytes, filename, toolSuffix);
}

export function triggerTextDownload(text: string, filename: string): void {
  downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), filename, '_extracted');
}

export async function deskewPdfInBrowser(
  file: File,
  degrees: number,
  onProgress?: (progress: PdfWorkerProgress) => void
): Promise<{ bytes: Uint8Array; downloadName: string }> {
  if (degrees === 0) {
    throw new Error('Adjust the rotation angle before straightening.');
  }

  const { loadPdfDocument, renderPdfPageToCanvas, canvasToJpegBlob, rotateCanvas } = await import(
    '../pdf/pdfRender'
  );
  const { runPdfWorkerWithJpegPages } = await import('../pdf/pdfWorkerClient');

  const pdf = await loadPdfDocument(file);
  const bytes = await runPdfWorkerWithJpegPages<Uint8Array>(
    pdf.numPages,
    async (pageIndex) => {
      const pageNum = pageIndex + 1;
      onProgress?.({
        current: pageIndex,
        total: pdf.numPages,
        label: `Straightening page ${pageNum} of ${pdf.numPages}…`,
      });
      const canvas = await renderPdfPageToCanvas(file, pageNum, 1.5);
      const rotated = rotateCanvas(canvas, degrees);
      const blob = await canvasToJpegBlob(rotated, 0.9);
      return new Uint8Array(await blob.arrayBuffer());
    },
    onProgress
  );

  const baseName = splitFilenameBase(file.name);
  return { bytes, downloadName: `${baseName}-straightened.pdf` };
}

export async function removePagesInBrowser(
  file: File,
  rangeInput: string,
  pageCount: number,
  onProgress?: (progress: PdfWorkerProgress) => void
): Promise<{ bytes: Uint8Array; downloadName: string; removedCount: number }> {
  const removeIndices = parsePageRange(rangeInput, pageCount);
  if (removeIndices.length >= pageCount) {
    throw new Error('Cannot remove every page — keep at least one.');
  }

  const { runPdfWorkerWithStreamedFile } = await import('../pdf/pdfWorkerClient');
  const bytes = await runPdfWorkerWithStreamedFile<Uint8Array>(
    'remove-pages',
    file,
    { removeIndices },
    onProgress
  );

  const baseName = splitFilenameBase(file.name);
  return {
    bytes,
    downloadName: `${baseName}-pages-removed.pdf`,
    removedCount: removeIndices.length,
  };
}

export interface PageNumbersOptions {
  vertical: PageNumberVertical;
  horizontal: PageNumberHorizontal;
  format: PageNumberFormat;
  fontSize: number;
  color: string;
  startNumber: number;
}

export async function addPageNumbersInBrowser(
  file: File,
  options: PageNumbersOptions,
  onProgress?: (progress: PdfWorkerProgress) => void
): Promise<{ bytes: Uint8Array; downloadName: string }> {
  const { runPdfWorkerWithStreamedFile } = await import('../pdf/pdfWorkerClient');
  const bytes = await runPdfWorkerWithStreamedFile<Uint8Array>(
    'add-page-numbers',
    file,
    {
      vertical: options.vertical,
      horizontal: options.horizontal,
      format: options.format,
      fontSize: options.fontSize,
      color: options.color,
      startNumber: options.startNumber,
    },
    onProgress
  );

  const baseName = splitFilenameBase(file.name);
  return { bytes, downloadName: `${baseName}-numbered.pdf` };
}

export async function cropPdfInBrowser(
  file: File,
  pageIndex: number,
  crop: NormalizedCropRect,
  pageWidth: number,
  pageHeight: number,
  onProgress?: (progress: PdfWorkerProgress) => void
): Promise<{ bytes: Uint8Array; downloadName: string }> {
  const pdfCrop = normalizedCropToPdfBox(crop, pageWidth, pageHeight);
  const { runPdfWorkerWithStreamedFile } = await import('../pdf/pdfWorkerClient');
  const bytes = await runPdfWorkerWithStreamedFile<Uint8Array>(
    'crop-pdf',
    file,
    { pageIndex, crop: pdfCrop },
    onProgress
  );

  const baseName = splitFilenameBase(file.name);
  return { bytes, downloadName: `${baseName}-cropped.pdf` };
}

export async function getPdfPageSize(
  file: File,
  pageNumber: number
): Promise<{ width: number; height: number }> {
  const { loadPdfDocument } = await import('../pdf/pdfRender');
  const pdf = await loadPdfDocument(file);
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  page.cleanup();
  return { width: viewport.width, height: viewport.height };
}

async function readImageForPdf(file: File): Promise<{ bytes: Uint8Array; kind: 'jpg' | 'png' }> {
  if (file.type === 'image/png') {
    return { bytes: new Uint8Array(await file.arrayBuffer()), kind: 'png' };
  }
  if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
    return { bytes: new Uint8Array(await file.arrayBuffer()), kind: 'jpg' };
  }

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Canvas not supported');
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const { canvasToPngBlob } = await import('../pdf/pdfRender');
  const blob = await canvasToPngBlob(canvas);
  return { bytes: new Uint8Array(await blob.arrayBuffer()), kind: 'png' };
}

export async function imageToPdfInBrowser(
  file: File,
  onProgress?: (progress: PdfWorkerProgress) => void
): Promise<{ bytes: Uint8Array; downloadName: string }> {
  onProgress?.({ current: 0, total: 1, label: 'Reading image…' });
  const image = await readImageForPdf(file);
  const { runPdfWorker } = await import('../pdf/pdfWorkerClient');
  const bytes = await runPdfWorker<Uint8Array>('images-to-pdf', { images: [image] }, onProgress);
  const baseName = splitImageFilenameBase(file.name);
  return { bytes, downloadName: `${baseName}.pdf` };
}

export async function exportPdfToJpgInBrowser(
  file: File,
  scale = 2,
  quality = 0.92,
  onProgress?: (progress: PdfWorkerProgress) => void
): Promise<{ pageCount: number }> {
  const { loadPdfDocument, renderPdfPageToCanvas, canvasToJpegBlob } = await import(
    '../pdf/pdfRender'
  );
  const pdf = await loadPdfDocument(file);

  for (let p = 1; p <= pdf.numPages; p++) {
    onProgress?.({
      current: p - 1,
      total: pdf.numPages,
      label: `Exporting page ${p} of ${pdf.numPages} as JPG…`,
    });
    const canvas = await renderPdfPageToCanvas(file, p, scale);
    const blob = await canvasToJpegBlob(canvas, quality);
    downloadBlob(blob, buildPageExportFilename(file.name, p, 'jpg'), '_converted');
  }

  return { pageCount: pdf.numPages };
}

export async function exportPdfToPngInBrowser(
  file: File,
  scale = 2,
  onProgress?: (progress: PdfWorkerProgress) => void
): Promise<{ pageCount: number }> {
  const { loadPdfDocument, renderPdfPageToCanvas, canvasToPngBlob } = await import(
    '../pdf/pdfRender'
  );
  const pdf = await loadPdfDocument(file);

  for (let p = 1; p <= pdf.numPages; p++) {
    onProgress?.({
      current: p - 1,
      total: pdf.numPages,
      label: `Exporting page ${p} of ${pdf.numPages} as PNG…`,
    });
    const canvas = await renderPdfPageToCanvas(file, p, scale);
    const blob = await canvasToPngBlob(canvas);
    downloadBlob(blob, buildPageExportFilename(file.name, p, 'png'), '_converted');
  }

  return { pageCount: pdf.numPages };
}

export async function extractPdfTextInBrowser(
  file: File,
  onProgress?: (progress: PdfWorkerProgress) => void
): Promise<{ text: string; pageCount: number }> {
  const { loadPdfDocument } = await import('../pdf/pdfRender');
  const pdf = await loadPdfDocument(file);
  const parts: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    onProgress?.({
      current: p - 1,
      total: pdf.numPages,
      label: `Extracting text — page ${p} of ${pdf.numPages}…`,
    });
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .trim();
    parts.push(`--- Page ${p} ---\n${pageText || '(no text detected)'}`);
    page.cleanup();
  }

  return { text: parts.join('\n\n'), pageCount: pdf.numPages };
}

export async function textToPdfInBrowser(
  text: string,
  onProgress?: (progress: PdfWorkerProgress) => void
): Promise<{ bytes: Uint8Array; downloadName: string }> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Type or paste some text before saving as PDF.');
  }

  const { runPdfWorker } = await import('../pdf/pdfWorkerClient');
  const bytes = await runPdfWorker<Uint8Array>('text-to-pdf', { text: trimmed }, onProgress);
  return { bytes, downloadName: 'typed-document.pdf' };
}

export type PageRotationAngle = 0 | 90 | 180 | 270;

export interface PageRotationSpec {
  pageIndex: number;
  angle: PageRotationAngle;
}

export async function rotatePdfPagesInBrowser(
  file: File,
  pageRotations: PageRotationSpec[],
  onProgress?: (progress: PdfWorkerProgress) => void
): Promise<{ bytes: Uint8Array; downloadName: string; rotatedCount: number }> {
  const active = pageRotations.filter((r) => r.angle > 0);
  if (active.length === 0) {
    throw new Error('Set a rotation angle for at least one page.');
  }

  const { runPdfWorkerWithStreamedFile } = await import('../pdf/pdfWorkerClient');
  const bytes = await runPdfWorkerWithStreamedFile<Uint8Array>(
    'rotate-pages',
    file,
    { pageRotations: active },
    onProgress
  );
  const baseName = splitFilenameBase(file.name);
  return { bytes, downloadName: `${baseName}-rotated.pdf`, rotatedCount: active.length };
}

export async function reorderPdfPagesInBrowser(
  file: File,
  order: number[],
  onProgress?: (progress: PdfWorkerProgress) => void
): Promise<{ bytes: Uint8Array; downloadName: string }> {
  const { runPdfWorkerWithStreamedFile } = await import('../pdf/pdfWorkerClient');
  const bytes = await runPdfWorkerWithStreamedFile<Uint8Array>(
    'reorder-pages',
    file,
    { order },
    onProgress
  );
  const baseName = splitFilenameBase(file.name);
  return { bytes, downloadName: `${baseName}-reordered.pdf` };
}

export interface WatermarkPdfOptions {
  text: string;
  color?: string;
  fontSize?: number;
  position?: OverlayPosition;
  opacity?: number;
  rotation?: number;
}

export async function watermarkPdfInBrowser(
  file: File,
  options: WatermarkPdfOptions,
  onProgress?: (progress: PdfWorkerProgress) => void
): Promise<{ bytes: Uint8Array; downloadName: string }> {
  const text = options.text.trim();
  if (!text) {
    throw new Error('Enter watermark text.');
  }

  const { runPdfWorkerWithStreamedFile } = await import('../pdf/pdfWorkerClient');
  const bytes = await runPdfWorkerWithStreamedFile<Uint8Array>(
    'watermark-pdf',
    file,
    {
      text,
      color: options.color ?? '#064e3b',
      fontSize: options.fontSize ?? 36,
      position: options.position ?? 'center',
      opacity: options.opacity ?? 0.2,
      rotation: options.rotation ?? -30,
    },
    onProgress
  );
  const baseName = splitFilenameBase(file.name);
  return { bytes, downloadName: `${baseName}-watermarked.pdf` };
}

export async function stripPdfMetadataInBrowser(
  file: File,
  onProgress?: (progress: PdfWorkerProgress) => void
): Promise<{ bytes: Uint8Array; downloadName: string }> {
  const { runPdfWorkerWithStreamedFile } = await import('../pdf/pdfWorkerClient');
  const bytes = await runPdfWorkerWithStreamedFile<Uint8Array>(
    'strip-metadata',
    file,
    {},
    onProgress
  );
  const baseName = splitFilenameBase(file.name);
  return { bytes, downloadName: `${baseName}-metadata-stripped.pdf` };
}

export async function repairPdfInBrowser(
  file: File,
  onProgress?: (progress: PdfWorkerProgress) => void
): Promise<{ bytes: Uint8Array; downloadName: string }> {
  const { runPdfWorkerWithStreamedFile } = await import('../pdf/pdfWorkerClient');
  const bytes = await runPdfWorkerWithStreamedFile<Uint8Array>(
    'repair-pdf',
    file,
    {},
    onProgress
  );
  const baseName = splitFilenameBase(file.name);
  return { bytes, downloadName: `${baseName}-repaired.pdf` };
}

export async function photoToScannedPdfInBrowser(
  file: File,
  options: { contrast?: number; threshold?: number } = {},
  onProgress?: (progress: PdfWorkerProgress) => void
): Promise<{ bytes: Uint8Array; downloadName: string }> {
  onProgress?.({ current: 0, total: 3, label: 'Applying scanner effect…' });
  const { applyScannerEffectToImageFile } = await import('../pdf/scannerEffect');
  const scanned = await applyScannerEffectToImageFile(file, options);
  onProgress?.({ current: 1, total: 3, label: 'Building scanned PDF…' });
  const { runPdfWorker } = await import('../pdf/pdfWorkerClient');
  const bytes = await runPdfWorker<Uint8Array>('images-to-pdf', { images: [scanned] }, onProgress);
  const baseName = splitImageFilenameBase(file.name);
  return { bytes, downloadName: `${baseName}-scanned.pdf` };
}

export interface SignPdfOptions {
  signatureBytes: Uint8Array;
  pageIndices?: number[];
  width?: number;
}

export async function signPdfInBrowser(
  file: File,
  options: SignPdfOptions,
  onProgress?: (progress: PdfWorkerProgress) => void
): Promise<{ bytes: Uint8Array; downloadName: string }> {
  if (!options.signatureBytes?.length) {
    throw new Error('Draw or type a signature first.');
  }
  const { runPdfWorkerWithStreamedFile } = await import('../pdf/pdfWorkerClient');
  const bytes = await runPdfWorkerWithStreamedFile<Uint8Array>(
    'sign-pdf',
    file,
    {
      signatureBytes: options.signatureBytes,
      pageIndices: options.pageIndices,
      width: options.width ?? 140,
    },
    onProgress
  );
  const baseName = splitFilenameBase(file.name);
  return { bytes, downloadName: `${baseName}-signed.pdf` };
}

export async function redactPdfInBrowser(
  file: File,
  redactions: import('../pdf/redactionTypes').PageRedactions[],
  onProgress?: (progress: PdfWorkerProgress) => void
): Promise<{ bytes: Uint8Array; downloadName: string }> {
  const { runPdfWorkerWithStreamedFile } = await import('../pdf/pdfWorkerClient');
  const bytes = await runPdfWorkerWithStreamedFile<Uint8Array>(
    'redact-pdf',
    file,
    { redactions },
    onProgress
  );
  const baseName = splitFilenameBase(file.name);
  return { bytes, downloadName: `${baseName}-redacted.pdf` };
}

export async function organisePdfPagesInBrowser(
  file: File,
  pageOrder: number[],
  onProgress?: (progress: PdfWorkerProgress) => void
): Promise<{ bytes: Uint8Array; downloadName: string }> {
  if (!pageOrder.length) throw new Error('Keep at least one page.');
  const { runPdfWorkerWithStreamedFile } = await import('../pdf/pdfWorkerClient');
  const bytes = await runPdfWorkerWithStreamedFile<Uint8Array>(
    'reorder-pages',
    file,
    { order: pageOrder },
    onProgress
  );
  const baseName = splitFilenameBase(file.name);
  return { bytes, downloadName: `${baseName}-organised.pdf` };
}

/** Render a typed signature to PNG bytes for stamping. */
export async function renderTypedSignaturePng(text: string, fontSize = 42): Promise<Uint8Array> {
  const label = text.trim();
  if (!label) throw new Error('Type your name to create a signature.');

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(280, label.length * (fontSize * 0.55));
  canvas.height = Math.round(fontSize * 1.8);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0f172a';
  ctx.font = `italic ${fontSize}px Georgia, serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 12, canvas.height / 2);

  const { canvasToPngBlob } = await import('../pdf/pdfRender');
  const blob = await canvasToPngBlob(canvas);
  return new Uint8Array(await blob.arrayBuffer());
}
