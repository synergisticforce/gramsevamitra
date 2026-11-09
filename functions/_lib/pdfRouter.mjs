import { PDFDocument } from '@cantoo/pdf-lib';
import { hasCorruptedLegacyIndicFont } from './adapters/baseAdapter.mjs';

/**
 * @param {Uint8Array | ArrayBuffer} pdfBytes
 * @returns {Promise<Uint8Array[]>}
 */
export async function chunkPdfMax10Pages(pdfBytes) {
  const source = await PDFDocument.load(pdfBytes);
  const total = source.getPageCount();
  /** @type {Uint8Array[]} */
  const chunks = [];
  for (let start = 0; start < total; start += 10) {
    const end = Math.min(start + 10, total);
    const indices = Array.from({ length: end - start }, (_, offset) => start + offset);
    const chunk = await PDFDocument.create();
    const pages = await chunk.copyPages(source, indices);
    pages.forEach((page) => chunk.addPage(page));
    chunks.push(await chunk.save());
  }
  return chunks;
}

/**
 * @param {Uint8Array | ArrayBuffer} pdfBytes
 * @param {number} [startPageIndex]
 */
export async function slicePdfMax2Pages(pdfBytes, startPageIndex = 0) {
  const source = await PDFDocument.load(pdfBytes);
  const end = Math.min(startPageIndex + 2, source.getPageCount());
  const indices = Array.from({ length: Math.max(0, end - startPageIndex) }, (_, offset) => startPageIndex + offset);
  const slice = await PDFDocument.create();
  const pages = await slice.copyPages(source, indices);
  pages.forEach((page) => slice.addPage(page));
  return slice.save();
}

/**
 * @param {Array<{ str: string, transform: number[] }>} items
 */
export function rowsFromTextItems(items) {
  const glyphs = items
    .filter((item) => item && item.str && Array.isArray(item.transform) && item.transform.length >= 6)
    .map((item) => ({
      text: String(item.str).trim(),
      x: item.transform[4],
      y: -item.transform[5],
    }))
    .filter((item) => item.text);
  glyphs.sort((a, b) => a.y - b.y || a.x - b.x);
  /** @type {typeof glyphs[]} */
  const bands = [];
  for (const glyph of glyphs) {
    const band = bands[bands.length - 1];
    if (!band || Math.abs(glyph.y - band[0].y) > 4) bands.push([glyph]);
    else band.push(glyph);
  }
  return bands.map((band) => band.sort((a, b) => a.x - b.x).map((glyph) => glyph.text));
}

/**
 * @param {Uint8Array | ArrayBuffer} pdfBytes
 */
export async function extractDigitalPdfRowsOrEscalate(pdfBytes) {
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
    const document = await pdfjs.getDocument({ data, disableWorker: true, isEvalSupported: false }).promise;
    let text = '';
    /** @type {string[][]} */
    const rows = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const items = content.items.filter((item) => item && 'str' in item);
      text += items.map((item) => item.str).join(' ');
      rows.push(...rowsFromTextItems(items));
    }
    const compact = text.replace(/\s+/g, '');
    const perPage = compact.length / Math.max(1, document.numPages);
    if (perPage < 20) return { mode: 'NEEDS_OCR', reason: 'NO_TEXT_LAYER' };
    if (hasCorruptedLegacyIndicFont(text)) return { mode: 'NEEDS_OCR', reason: 'CORRUPTED_FONT' };
    return { mode: 'DIGITAL_EXTRACTED', rows };
  } catch {
    return { mode: 'NEEDS_OCR', reason: 'NO_TEXT_LAYER' };
  }
}

export { hasCorruptedLegacyIndicFont };
