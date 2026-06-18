/**
 * Pro layout reconstruction — Google Cloud Vision DOCUMENT_TEXT_DETECTION mock
 * with bounding-box table assembly for txt/docx/xlsx outputs.
 */

import { callPaddleOcr } from './ocrEngines.mjs';
import { MOCK_DOCX_BASE64 } from './proTransientStorage.mjs';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function blocksToPlainText(blocks) {
  return blocks
    .map((block) => {
      if (block.text) return block.text;
      if (block.rows?.length) {
        return block.rows.map((row) => row.join('\t')).join('\n');
      }
      return block.words?.map((w) => w.text).join(' ') ?? '';
    })
    .filter(Boolean)
    .join('\n\n');
}

function blocksToRows(blocks) {
  const table = blocks.find((b) => b.type === 'table');
  if (table?.words?.length) {
    const header = table.words.map((w) => w.text ?? '');
    return [header, ['Line item A', '2', '199.00'], ['Line item B', '1', '350.00']];
  }
  return blocks
    .flatMap((b) => b.words ?? [])
    .map((w) => [w.text ?? '']);
}

/**
 * @param {{
 *   fileName?: string;
 *   outputFormat?: 'txt' | 'docx' | 'xlsx';
 *   onStage?: (label: string) => void;
 * }} opts
 */
export async function runLayoutReconstruction(opts = {}) {
  const outputFormat = opts.outputFormat ?? 'docx';
  const fileName = opts.fileName ?? 'document.pdf';
  const onStage = opts.onStage ?? (() => {});

  onStage('Analyzing layout bounds…');
  await sleep(900);

  onStage('Parsing structural tables…');
  const paddle = await callPaddleOcr({
    fileName,
    documentType: 'general',
    forceLowConfidence: false,
  });
  await sleep(1100);

  onStage('Rebuilding native margins…');
  await sleep(800);

  const blocks = paddle.blocks ?? [];
  const plain = blocksToPlainText(blocks);
  const rows = blocksToRows(blocks);
  const baseName = fileName.replace(/\.[^.]+$/, '') || 'document';

  if (outputFormat === 'txt') {
    const encoded = new TextEncoder().encode(plain || 'Extracted text');
    return {
      format: 'txt',
      fileName: `${baseName}.txt`,
      contentType: 'text/plain;charset=utf-8',
      bytes: encoded,
      pipeline: paddle.pipeline ?? [],
    };
  }

  if (outputFormat === 'csv') {
    const csvLines = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','));
    const csvBody = ['"Column A","Column B","Column C"', ...csvLines].join('\n');
    const encoded = new TextEncoder().encode(csvBody);
    return {
      format: 'csv',
      fileName: `${baseName}.csv`,
      contentType: 'text/csv;charset=utf-8',
      bytes: encoded,
      pipeline: paddle.pipeline ?? [],
    };
  }

  if (outputFormat === 'xml') {
    const xmlRows = rows
      .map(
        (row, index) =>
          `  <row id="${index + 1}">${row.map((cell) => `<cell>${String(cell).replace(/[<>&]/g, '')}</cell>`).join('')}</row>`,
      )
      .join('\n');
    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>\n<document>\n${xmlRows}\n</document>`;
    const encoded = new TextEncoder().encode(xmlBody);
    return {
      format: 'xml',
      fileName: `${baseName}.xml`,
      contentType: 'application/xml;charset=utf-8',
      bytes: encoded,
      pipeline: paddle.pipeline ?? [],
    };
  }

  if (outputFormat === 'xlsx') {
    const csvLines = rows.map((row) => row.join(','));
    const csvBody = ['Column A,Column B,Column C', ...csvLines].join('\n');
    const encoded = new TextEncoder().encode(csvBody);
    return {
      format: 'xlsx',
      fileName: `${baseName}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      bytes: encoded,
      pipeline: paddle.pipeline ?? [],
      mockSpreadsheet: true,
    };
  }

  const docxParagraphs = plain.split(/\n{2,}/).filter(Boolean);
  const docxBody = docxParagraphs.join('\n') || plain;
  const docxBytes = Buffer.from(MOCK_DOCX_BASE64, 'base64');
  return {
    format: 'docx',
    fileName: `${baseName}.docx`,
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    bytes: docxBytes,
    extractedPreview: docxBody.slice(0, 500),
    pipeline: paddle.pipeline ?? [],
    mockDocx: true,
  };
}
