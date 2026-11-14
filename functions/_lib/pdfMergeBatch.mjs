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

const LARGE_FILE_COUNT = 20;
const LARGE_BYTE_COUNT = 50 * 1024 * 1024;

/**
 * @param {Array<{ size?: number }>} files
 */
export function needsLargeMergeWarning(files) {
  const count = files.length;
  const bytes = files.reduce((sum, file) => sum + Number(file?.size || 0), 0);
  return count > LARGE_FILE_COUNT || bytes > LARGE_BYTE_COUNT;
}

/**
 * Read one PDF at a time. The caller keeps File handles, not decoded bytes.
 * @param {Array<{ arrayBuffer: () => Promise<ArrayBuffer> }>} sources
 * @param {{ yieldEvery?: number, yieldToUi?: boolean, onProgress?: (current: number, total: number) => void }} [options]
 */
export async function mergePdfSourcesSequentially(sources, options = {}) {
  const out = await PDFDocument.create();
  const yieldEvery = options.yieldEvery ?? 3;
  for (let index = 0; index < sources.length; index += 1) {
    let bytes = await sources[index].arrayBuffer();
    const source = await PDFDocument.load(bytes);
    bytes = null;
    const copied = await out.copyPages(source, source.getPageIndices());
    copied.forEach((page) => out.addPage(page));
    options.onProgress?.(index + 1, sources.length);
    if (options.yieldToUi !== false && (index + 1) % yieldEvery === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  return out.save();
}

/**
 * @param {ArrayBuffer[]} buffers
 * @param {{ yieldEvery?: number, yieldToUi?: boolean, onProgress?: (current: number, total: number) => void }} [options]
 */
export async function mergePdfBytesSequentially(buffers, options = {}) {
  return mergePdfSourcesSequentially(
    buffers.map((buffer) => ({ arrayBuffer: async () => buffer })),
    options,
  );
}
