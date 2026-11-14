import { PDFDocument } from '@cantoo/pdf-lib';

/**
 * @param {Array<{ name?: string } | string>} files
 */
export function naturalPdfNameSort(files) {
  return [...files].sort((a, b) => {
    const left = typeof a === 'string' ? a : String(a?.name || '');
    const right = typeof b === 'string' ? b : String(b?.name || '');
    return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
  });
}

/**
 * Copy PDF pages one file at a time so a 72-file merge does not hold every
 * source document in memory together. Yields to the UI every few files.
 * @param {ArrayBuffer[]} buffers
 * @param {{ yieldEvery?: number, yieldToUi?: boolean, onProgress?: (current: number, total: number) => void }} [options]
 */
export async function mergePdfBytesSequentially(buffers, options = {}) {
  const out = await PDFDocument.create();
  const yieldEvery = options.yieldEvery ?? 5;
  for (let index = 0; index < buffers.length; index += 1) {
    const source = await PDFDocument.load(buffers[index]);
    const copied = await out.copyPages(source, source.getPageIndices());
    copied.forEach((page) => out.addPage(page));
    options.onProgress?.(index + 1, buffers.length);
    buffers[index] = new ArrayBuffer(0);
    if (options.yieldToUi !== false && (index + 1) % yieldEvery === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  return out.save();
}
