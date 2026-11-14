import { convertDocumentWithCloud } from './documentCloudOcr.mjs';
import { chunkPdfMax10Pages, slicePdfMax2Pages } from './pdfRouter.mjs';
import { isPiiHeader, scrubCustomerPiiRow } from './adapters/baseAdapter.mjs';
import { PDFDocument } from '@cantoo/pdf-lib';

/**
 * Redact phones and emails in free text. Order ids, UTRs, GSTINs, and rupee
 * amounts stay because they do not match a bare 10-digit Indian mobile.
 * @param {unknown} value
 */
export function redactOcrFreeText(value) {
  return String(value ?? '')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]')
    .replace(/\b[6-9]\d{9}\b/g, '[REDACTED_PHONE]');
}

/**
 * @param {unknown[]} row
 */
function scrubArrayRow(row, dropIndexes) {
  return row
    .filter((_, index) => !dropIndexes[index])
    .map((cell) => (typeof cell === 'string' ? redactOcrFreeText(cell) : cell));
}

/**
 * Drop PII columns and redact phones/emails before a cloud OCR payload is
 * returned or stored. Never pass raw PDF bytes through this function.
 * @param {Record<string, unknown> | null | undefined} ocrData
 */
export function scrubOcrOutputPii(ocrData) {
  const data = ocrData && typeof ocrData === 'object' ? { ...ocrData } : {};
  const sourceRows = Array.isArray(data.rows) ? data.rows : [];
  if (sourceRows.length && Array.isArray(sourceRows[0]) && sourceRows[0].every((cell) => typeof cell !== 'object' || cell == null)) {
    const headers = sourceRows[0].map((cell) => String(cell ?? ''));
    const drop = headers.map((header) => isPiiHeader(header));
    data.rows = sourceRows.map((row) => scrubArrayRow(Array.isArray(row) ? row : [row], drop));
  } else {
    data.rows = sourceRows.map((row) => {
      if (Array.isArray(row)) return row.map((cell) => (typeof cell === 'string' ? redactOcrFreeText(cell) : cell));
      if (row && typeof row === 'object') {
        const clean = scrubCustomerPiiRow({ ...row });
        for (const key of Object.keys(clean)) {
          if (typeof clean[key] === 'string') clean[key] = redactOcrFreeText(clean[key]);
        }
        return clean;
      }
      return typeof row === 'string' ? redactOcrFreeText(row) : row;
    });
  }
  if (typeof data.text === 'string') data.text = redactOcrFreeText(data.text);
  return data;
}

/**
 * @param {Uint8Array} bytes
 * @param {string} mimeType
 */
async function pageCount(bytes, mimeType) {
  if (mimeType !== 'application/pdf') return 1;
  const document = await PDFDocument.load(bytes);
  return document.getPageCount();
}

/**
 * @param {{
 *   bytes: Uint8Array,
 *   mimeType: string,
 *   fileName: string,
 *   language?: string,
 *   azureEndpoint?: string,
 *   azureKey?: string,
 *   sarvamKey?: string,
 *   geminiKey?: string,
 * }} input
 */
export async function extractScannedPayout(input) {
  const mimeType = input.mimeType || 'application/pdf';
  const language = input.language || 'en';
  const english = language.toLowerCase().startsWith('en');
  if (mimeType !== 'application/pdf') {
    return scrubOcrOutputPii(await convertDocumentWithCloud({ ...input, mimeType, language }));
  }
  const pages = await pageCount(input.bytes, mimeType);
  if (english && input.azureKey) {
    const bytes = pages > 2 ? await slicePdfMax2Pages(input.bytes, 0) : input.bytes;
    return scrubOcrOutputPii(await convertDocumentWithCloud({ ...input, bytes, mimeType, language }));
  }
  if (pages > 10) {
    const chunks = await chunkPdfMax10Pages(input.bytes);
    /** @type {string[][]} */
    const rows = [];
    let text = '';
    let provider = '';
    for (const chunk of chunks) {
      const part = await convertDocumentWithCloud({ ...input, bytes: chunk, mimeType, language });
      rows.push(...(part.rows || []));
      text += `${part.text || ''}\n`;
      provider = part.provider || provider;
    }
    return scrubOcrOutputPii({ rows, text: text.trim(), provider });
  }
  return scrubOcrOutputPii(await convertDocumentWithCloud({ ...input, mimeType, language }));
}
