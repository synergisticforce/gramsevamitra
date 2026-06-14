import { formatFileSize } from './documentCanvasStorage';
import { downloadPdfBytes } from '../pdf/downloadPdf';
import { formatUnlockError } from '../pdf/pdfEncryption';
import { parsePageRange } from '../pdf/pageRangeParser';
import type { PdfWorkerProgress } from '../pdf/pdfWorkerClient';

export function isPdfMimeOrName(type: string, name: string): boolean {
  return type === 'application/pdf' || name.toLowerCase().endsWith('.pdf');
}

export function splitFilenameBase(name: string): string {
  return name.replace(/\.pdf$/i, '') || 'document';
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
  toolSuffix: '_merged' | '_extracted' | '_compressed' | '_protected' | '_unlocked'
): void {
  downloadPdfBytes(bytes, filename, toolSuffix);
}
