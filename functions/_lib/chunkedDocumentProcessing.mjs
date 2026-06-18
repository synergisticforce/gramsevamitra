import {
  bottomLeftForCenterRotation,
  cssRotationToPdfDegrees,
  formatPageNumber,
  hexToRgb01,
  overlayPositionToPdfCoords,
  pageNumberPlacementToPdfCoords,
} from './pdfOverlayHelpers.mjs';

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
  const { PDFDocument } = await import('@cantoo/pdf-lib');
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
  const { PDFDocument } = await import('@cantoo/pdf-lib');
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

async function loadPdfDoc(bucket, objectKey) {
  const bytes = await loadPdfBytes(bucket, objectKey);
  const { PDFDocument } = await import('@cantoo/pdf-lib');
  return PDFDocument.load(bytes, { ignoreEncryption: true });
}

function pdfResponse(outBytes, outName, extraHeaders = {}) {
  return new Response(outBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': contentDisposition(outName),
      'Cache-Control': 'no-store',
      'X-GSM-File-Name': outName,
      ...extraHeaders,
    },
  });
}

async function stripPdfMetadataBytes(srcBytes) {
  const { PDFDocument } = await import('@cantoo/pdf-lib');
  const source = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const indices = source.getPageIndices();
  const copied = await out.copyPages(source, indices);
  for (const page of copied) out.addPage(page);
  out.setTitle('');
  out.setAuthor('');
  out.setSubject('');
  out.setKeywords([]);
  out.setCreator('');
  out.setProducer('');
  return out.save({ useObjectStreams: true });
}

export async function compressChunkedPdf({ bucket, objectKey, fileName, preset = 'balanced' }) {
  const srcBytes = await loadPdfBytes(bucket, objectKey);
  const originalSize = srcBytes.byteLength;
  const outBytes = await stripPdfMetadataBytes(srcBytes);
  const baseName = (fileName || 'document.pdf').replace(/\.pdf$/i, '') || 'document';
  const outName = `${baseName}_compressed.pdf`;
  const savedPct =
    originalSize > 0 ? Math.max(0, Math.round((1 - outBytes.byteLength / originalSize) * 100)) : 0;

  return pdfResponse(outBytes, outName, {
    'X-GSM-Original-Bytes': String(originalSize),
    'X-GSM-Output-Bytes': String(outBytes.byteLength),
    'X-GSM-Savings-Pct': String(savedPct),
    'X-GSM-Compress-Preset': preset,
  });
}

export async function removePagesChunkedPdf({
  bucket,
  objectKey,
  rangeInput,
  fileName,
}) {
  const source = await loadPdfDoc(bucket, objectKey);
  const total = source.getPageCount();
  const removeIndices = parsePageRange(rangeInput, total);
  if (removeIndices.length >= total) {
    throw new Error('Cannot remove every page — keep at least one.');
  }
  const removeSet = new Set(removeIndices);
  const keep = [...Array(total).keys()].filter((i) => !removeSet.has(i));

  const { PDFDocument } = await import('@cantoo/pdf-lib');
  const out = await PDFDocument.create();
  const copied = await out.copyPages(source, keep);
  for (const page of copied) out.addPage(page);
  const outBytes = await out.save({ useObjectStreams: true });

  const baseName = (fileName || 'document.pdf').replace(/\.pdf$/i, '') || 'document';
  const outName = `${baseName}_pages-removed.pdf`;

  return pdfResponse(outBytes, outName, {
    'X-GSM-Removed-Count': String(removeIndices.length),
  });
}

export async function reorderChunkedPdf({ bucket, objectKey, order, fileName }) {
  if (!Array.isArray(order) || !order.length) {
    throw new Error('Page order is required.');
  }

  const source = await loadPdfDoc(bucket, objectKey);
  const { PDFDocument } = await import('@cantoo/pdf-lib');
  const out = await PDFDocument.create();
  const copied = await out.copyPages(source, order);
  for (const page of copied) out.addPage(page);
  const outBytes = await out.save({ useObjectStreams: true });

  const baseName = (fileName || 'document.pdf').replace(/\.pdf$/i, '') || 'document';
  return pdfResponse(outBytes, `${baseName}_reordered.pdf`);
}

export async function rotateChunkedPdf({ bucket, objectKey, pageRotations, fileName }) {
  const rotations = Array.isArray(pageRotations)
    ? pageRotations.filter((r) => r && r.angle > 0)
    : [];
  if (!rotations.length) throw new Error('Set a rotation angle for at least one page.');

  const { PDFDocument, degrees } = await import('@cantoo/pdf-lib');
  const doc = await loadPdfDoc(bucket, objectKey);
  const pages = doc.getPages();
  for (const { pageIndex, angle } of rotations) {
    if (pages[pageIndex]) pages[pageIndex].setRotation(degrees(angle));
  }
  const outBytes = await doc.save({ useObjectStreams: true });
  const baseName = (fileName || 'document.pdf').replace(/\.pdf$/i, '') || 'document';
  return pdfResponse(outBytes, `${baseName}_rotated.pdf`, {
    'X-GSM-Rotated-Count': String(rotations.length),
  });
}

export async function protectChunkedPdf({
  bucket,
  objectKey,
  userPassword,
  ownerPassword,
  fileName,
}) {
  if (!userPassword) throw new Error('User password is required.');

  const { PDFDocument } = await import('@cantoo/pdf-lib');
  const doc = await loadPdfDoc(bucket, objectKey);
  doc.encrypt({
    userPassword,
    ownerPassword: ownerPassword || userPassword,
    permissions: {
      printing: 'highResolution',
      modifying: false,
      copying: false,
      annotating: false,
      fillingForms: false,
      contentAccessibility: false,
      documentAssembly: false,
    },
  });
  const outBytes = await doc.save({ useObjectStreams: true });
  const baseName = (fileName || 'document.pdf').replace(/\.pdf$/i, '') || 'document';
  return pdfResponse(outBytes, `${baseName}_protected.pdf`);
}

export async function unlockChunkedPdf({ bucket, objectKey, password, fileName }) {
  if (!password) throw new Error('Password is required.');

  const bytes = await loadPdfBytes(bucket, objectKey);
  const { PDFDocument } = await import('@cantoo/pdf-lib');
  let source;
  try {
    source = await PDFDocument.load(bytes, { password });
  } catch {
    throw new Error('Incorrect password or unable to decrypt this document.');
  }

  const out = await PDFDocument.create();
  const copied = await out.copyPages(source, source.getPageIndices());
  for (const page of copied) out.addPage(page);
  const outBytes = await out.save({ useObjectStreams: true });
  const baseName = (fileName || 'document.pdf').replace(/\.pdf$/i, '') || 'document';
  return pdfResponse(outBytes, `${baseName}_unlocked.pdf`);
}

export async function watermarkChunkedPdf({
  bucket,
  objectKey,
  text,
  position = 'center',
  opacity = 0.2,
  rotation = -30,
  fileName,
}) {
  const label = String(text || '').trim();
  if (!label) throw new Error('Watermark text is required.');

  const { PDFDocument, StandardFonts, rgb, degrees } = await import('@cantoo/pdf-lib');
  const doc = await loadPdfDoc(bucket, objectKey);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontSize = 36;
  const c = hexToRgb01('#064e3b');

  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(label, fontSize);
    const { x: boxX, y: boxY } = overlayPositionToPdfCoords(
      position,
      width,
      height,
      textWidth,
      fontSize,
    );
    const cx = boxX + textWidth / 2;
    const cy = boxY + fontSize / 2;
    const { x, y } = bottomLeftForCenterRotation(cx, cy, textWidth, fontSize, rotation);
    page.drawText(label, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(c.r, c.g, c.b),
      opacity,
      rotate: degrees(cssRotationToPdfDegrees(rotation)),
    });
  }

  const outBytes = await doc.save({ useObjectStreams: true });
  const baseName = (fileName || 'document.pdf').replace(/\.pdf$/i, '') || 'document';
  return pdfResponse(outBytes, `${baseName}_watermarked.pdf`);
}

export async function pageNumbersChunkedPdf({
  bucket,
  objectKey,
  vertical = 'bottom',
  horizontal = 'center',
  format = 'plain',
  fontSize = 11,
  color = '#333333',
  startNumber = 1,
  fileName,
}) {
  const { PDFDocument, StandardFonts, rgb } = await import('@cantoo/pdf-lib');
  const doc = await loadPdfDoc(bucket, objectKey);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const c = hexToRgb01(color);
  const pages = doc.getPages();
  const total = pages.length;
  const startAt = Math.max(1, startNumber);

  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i];
    const { width, height } = page.getSize();
    const displayNum = startAt + i;
    const label = formatPageNumber(format, displayNum, startAt + total - 1);
    const textWidth = font.widthOfTextAtSize(label, fontSize);
    const { x, y } = pageNumberPlacementToPdfCoords(
      vertical,
      horizontal,
      width,
      height,
      textWidth,
      fontSize,
    );
    page.drawText(label, { x, y, size: fontSize, font, color: rgb(c.r, c.g, c.b) });
  }

  const outBytes = await doc.save({ useObjectStreams: true });
  const baseName = (fileName || 'document.pdf').replace(/\.pdf$/i, '') || 'document';
  return pdfResponse(outBytes, `${baseName}_numbered.pdf`);
}

export async function cropChunkedPdf({ bucket, objectKey, pageIndex, crop, fileName }) {
  const doc = await loadPdfDoc(bucket, objectKey);
  const page = doc.getPages()[pageIndex];
  if (!page) throw new Error('Page not found.');

  page.setCropBox(crop.x, crop.y, crop.width, crop.height);
  page.setMediaBox(crop.x, crop.y, crop.width, crop.height);
  const outBytes = await doc.save({ useObjectStreams: true });
  const baseName = (fileName || 'document.pdf').replace(/\.pdf$/i, '') || 'document';
  return pdfResponse(outBytes, `${baseName}_cropped.pdf`);
}

export async function stripMetadataChunkedPdf({ bucket, objectKey, fileName }) {
  const srcBytes = await loadPdfBytes(bucket, objectKey);
  const outBytes = await stripPdfMetadataBytes(srcBytes);
  const baseName = (fileName || 'document.pdf').replace(/\.pdf$/i, '') || 'document';
  return pdfResponse(outBytes, `${baseName}_metadata-stripped.pdf`);
}

function truncateIncrementalUpdates(input) {
  const eofMarker = new TextEncoder().encode('%%EOF');
  let lastEof = -1;
  outer: for (let i = input.length - eofMarker.length; i >= 0; i -= 1) {
    for (let j = 0; j < eofMarker.length; j += 1) {
      if (input[i + j] !== eofMarker[j]) continue outer;
    }
    lastEof = i;
    break;
  }
  if (lastEof < 0) return input;
  return input.subarray(0, lastEof + eofMarker.length);
}

export async function repairChunkedPdf({ bucket, objectKey, fileName }) {
  let bytes = await loadPdfBytes(bucket, objectKey);
  bytes = truncateIncrementalUpdates(bytes);

  const { PDFDocument } = await import('@cantoo/pdf-lib');
  let source;
  try {
    source = await PDFDocument.load(bytes, { ignoreEncryption: true });
  } catch {
    throw new Error('Could not repair this PDF — the file may be too severely damaged.');
  }

  const out = await PDFDocument.create();
  const copied = await out.copyPages(source, source.getPageIndices());
  for (const page of copied) out.addPage(page);
  const outBytes = await out.save({ useObjectStreams: true });
  const baseName = (fileName || 'document.pdf').replace(/\.pdf$/i, '') || 'document';
  return pdfResponse(outBytes, `${baseName}_repaired.pdf`);
}

export async function organiseChunkedPdf({ bucket, objectKey, order, fileName }) {
  if (!Array.isArray(order) || !order.length) {
    throw new Error('Page order is required.');
  }

  const source = await loadPdfDoc(bucket, objectKey);
  const { PDFDocument } = await import('@cantoo/pdf-lib');
  const out = await PDFDocument.create();
  const copied = await out.copyPages(source, order);
  for (const page of copied) out.addPage(page);
  const outBytes = await out.save({ useObjectStreams: true });
  const baseName = (fileName || 'document.pdf').replace(/\.pdf$/i, '') || 'document';
  return pdfResponse(outBytes, `${baseName}_organised.pdf`);
}

function decodeBase64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function normalizedBoxToPdf(box, pageWidth, pageHeight) {
  const width = box.w * pageWidth;
  const height = box.h * pageHeight;
  const x = box.x * pageWidth;
  const y = pageHeight - (box.y + box.h) * pageHeight;
  return { x, y, width, height };
}

export async function signChunkedPdf({
  bucket,
  objectKey,
  fileName,
  signatureBase64,
  pageIndices,
  width = 140,
}) {
  if (!signatureBase64) throw new Error('Signature image is required.');

  const { PDFDocument } = await import('@cantoo/pdf-lib');
  const doc = await loadPdfDoc(bucket, objectKey);
  const signatureBytes = decodeBase64ToBytes(signatureBase64);
  const embedded = await doc.embedPng(signatureBytes);
  const pages = doc.getPages();
  const targets =
    Array.isArray(pageIndices) && pageIndices.length
      ? pageIndices
      : pages.map((_, i) => i);
  const drawWidth = width;
  const drawHeight = drawWidth * (embedded.height / embedded.width);

  for (const pageIndex of targets) {
    const page = pages[pageIndex];
    if (!page) continue;
    page.drawImage(embedded, { x: 36, y: 36, width: drawWidth, height: drawHeight });
  }

  const outBytes = await doc.save({ useObjectStreams: true });
  const baseName = (fileName || 'document.pdf').replace(/\.pdf$/i, '') || 'document';
  return pdfResponse(outBytes, `${baseName}_signed.pdf`);
}

export async function redactChunkedPdf({ bucket, objectKey, fileName, redactions }) {
  const active = Array.isArray(redactions) ? redactions.filter((r) => r.boxes?.length) : [];
  if (!active.length) throw new Error('Draw at least one redaction box.');

  const { PDFDocument, rgb } = await import('@cantoo/pdf-lib');
  const doc = await loadPdfDoc(bucket, objectKey);
  const pages = doc.getPages();

  for (const { pageIndex, boxes } of active) {
    const page = pages[pageIndex];
    if (!page) continue;
    const { width, height } = page.getSize();
    for (const box of boxes) {
      const rect = normalizedBoxToPdf(box, width, height);
      page.drawRectangle({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        color: rgb(0, 0, 0),
        borderWidth: 0,
      });
    }
  }

  const outBytes = await doc.save({ useObjectStreams: true });
  const baseName = (fileName || 'document.pdf').replace(/\.pdf$/i, '') || 'document';
  return pdfResponse(outBytes, `${baseName}_redacted.pdf`);
}

export async function extractTextChunkedPdf({ bucket, objectKey }) {
  const srcBytes = await loadPdfBytes(bucket, objectKey);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = pdfjs.getDocument({ data: srcBytes, useSystemFonts: true });
  const pdf = await loadingTask.promise;
  const parts = [];

  for (let p = 1; p <= pdf.numPages; p += 1) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => (item && typeof item.str === 'string' ? item.str : ''))
      .join(' ')
      .trim();
    parts.push(`--- Page ${p} ---\n${pageText || '(no text detected)'}`);
    page.cleanup();
  }

  return new Response(
    JSON.stringify({ text: parts.join('\n\n'), pageCount: pdf.numPages }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-GSM-Page-Count': String(pdf.numPages),
      },
    },
  );
}

const OPERATION_HANDLERS = {
  compress: compressChunkedPdf,
  'remove-pages': removePagesChunkedPdf,
  reorder: reorderChunkedPdf,
  rotate: rotateChunkedPdf,
  protect: protectChunkedPdf,
  unlock: unlockChunkedPdf,
  watermark: watermarkChunkedPdf,
  'page-numbers': pageNumbersChunkedPdf,
  crop: cropChunkedPdf,
  organise: organiseChunkedPdf,
  'strip-metadata': stripMetadataChunkedPdf,
  repair: repairChunkedPdf,
  sign: signChunkedPdf,
  redact: redactChunkedPdf,
  'extract-text': extractTextChunkedPdf,
};

export async function processChunkedDocument({ bucket, operation, objectKey, fileName, params }) {
  const handler = OPERATION_HANDLERS[operation];
  if (!handler) throw new Error(`Unsupported chunked operation: ${operation}`);
  return handler({ bucket, objectKey, fileName, ...(params || {}) });
}

