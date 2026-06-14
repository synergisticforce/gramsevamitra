import { downloadPdfBytes } from '../pdf/downloadPdf';
import { parsePageRange } from '../pdf/pageRangeParser';
import type { PdfWorkerProgress } from '../pdf/pdfWorkerClient';

export function isPdfMimeOrName(type: string, name: string): boolean {
  return type === 'application/pdf' || name.toLowerCase().endsWith('.pdf');
}

export function splitFilenameBase(name: string): string {
  return name.replace(/\.pdf$/i, '') || 'document';
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

export function triggerPdfDownload(
  bytes: Uint8Array,
  filename: string,
  toolSuffix: '_merged' | '_extracted'
): void {
  downloadPdfBytes(bytes, filename, toolSuffix);
}
