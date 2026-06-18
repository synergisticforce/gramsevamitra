const CHUNKED_STAGED_PREFIX = 'chunked/v1/';

function isAllowedStagedKey(key) {
  return typeof key === 'string' && key.startsWith(CHUNKED_STAGED_PREFIX) && key.includes('/staged/');
}

function parsePageRange(rangeInput, pageCount) {
  const text = String(rangeInput || '').trim();
  if (!text) throw new Error('Page range is required.');

  /** @type {Set<number>} */
  const selected = new Set();
  const chunks = text.split(',').map((part) => part.trim()).filter(Boolean);
  if (!chunks.length) throw new Error('Invalid page range.');

  for (const part of chunks) {
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) throw new Error(`Invalid range part: "${part}"`);
    const start = Number(m[1]);
    const end = m[2] ? Number(m[2]) : start;
    if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
      throw new Error(`Range "${part}" is outside page count.`);
    }
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    for (let i = lo; i <= hi; i += 1) {
      selected.add(i - 1);
    }
  }

  const indices = Array.from(selected.values()).sort((a, b) => a - b);
  if (!indices.length) throw new Error('No pages selected.');
  return indices;
}

async function loadPdfBytes(bucket, objectKey) {
  if (!isAllowedStagedKey(objectKey)) {
    throw new Error('Invalid staged object key.');
  }
  const object = await bucket.get(objectKey);
  if (!object) throw new Error('Staged object not found or expired.');
  const buffer = await object.arrayBuffer();
  return new Uint8Array(buffer);
}

function contentDisposition(fileName) {
  const safe = (fileName || 'document.pdf').replace(/[^\w.\- ]+/g, '_');
  return `attachment; filename="${safe}"`;
}

export async function splitChunkedPdf({ bucket, objectKey, rangeInput, fileName }) {
  const { PDFDocument } = await import('pdf-lib');
  const srcBytes = await loadPdfBytes(bucket, objectKey);
  const srcDoc = await PDFDocument.load(srcBytes);
  const indices = parsePageRange(rangeInput, srcDoc.getPageCount());

  const outDoc = await PDFDocument.create();
  const copied = await outDoc.copyPages(srcDoc, indices);
  for (const page of copied) outDoc.addPage(page);
  const outBytes = await outDoc.save();

  const baseName = (fileName || 'document.pdf').replace(/\.pdf$/i, '') || 'document';
  const outName = `${baseName}_split.pdf`;

  return new Response(outBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': contentDisposition(outName),
      'Cache-Control': 'no-store',
      'X-GSM-File-Name': outName,
      'X-GSM-Pages': String(indices.length),
    },
  });
}

export async function mergeChunkedPdfs({ bucket, objectKeys, fileName }) {
  const { PDFDocument } = await import('pdf-lib');
  if (!Array.isArray(objectKeys) || objectKeys.length < 2) {
    throw new Error('At least two staged PDFs are required for merge.');
  }

  const outDoc = await PDFDocument.create();
  for (const key of objectKeys) {
    const bytes = await loadPdfBytes(bucket, key);
    const doc = await PDFDocument.load(bytes);
    const pages = await outDoc.copyPages(doc, doc.getPageIndices());
    for (const page of pages) outDoc.addPage(page);
  }
  const outBytes = await outDoc.save();

  const baseName = (fileName || 'merged.pdf').replace(/\.pdf$/i, '') || 'merged';
  const outName = `${baseName}_merged.pdf`;

  return new Response(outBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': contentDisposition(outName),
      'Cache-Control': 'no-store',
      'X-GSM-File-Name': outName,
    },
  });
}

export function getSafeStagedKeys(input) {
  if (!Array.isArray(input)) return [];
  return input.filter((key) => isAllowedStagedKey(key));
}

