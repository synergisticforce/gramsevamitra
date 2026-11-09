import { convertDocumentWithCloud } from './documentCloudOcr.mjs';
import { chunkPdfMax10Pages, slicePdfMax2Pages } from './pdfRouter.mjs';
import { PDFDocument } from '@cantoo/pdf-lib';

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
    return convertDocumentWithCloud({ ...input, mimeType, language });
  }
  const pages = await pageCount(input.bytes, mimeType);
  if (english && input.azureKey) {
    const bytes = pages > 2 ? await slicePdfMax2Pages(input.bytes, 0) : input.bytes;
    return convertDocumentWithCloud({ ...input, bytes, mimeType, language });
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
    return { rows, text: text.trim(), provider };
  }
  return convertDocumentWithCloud({ ...input, mimeType, language });
}
