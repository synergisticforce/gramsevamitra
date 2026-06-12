import { PDFDocument, StandardFonts, rgb, degrees, BlendMode, type PDFPage } from '@cantoo/pdf-lib';
import { sanitizePdfForExtremeCompression, TINY_JPEG } from '../lib/pdfByteSanitizer';
import { assembleChunks } from '../lib/pdfStreamTransfer';
import {
  overlayPositionToPdfCoords,
  pageNumberPlacementToPdfCoords,
  hexToRgb01,
  formatPageNumber,
  cssRotationToPdfDegrees,
  bottomLeftForCenterRotation,
  type OverlayPosition,
  type OverlayMargins,
  type PageNumberFormat,
  type PageNumberVertical,
  type PageNumberHorizontal,
  type WatermarkFontFamily,
  type WatermarkLayer,
} from '../lib/overlayPosition';

type ProgressMsg = { type: 'progress'; id: string; current: number; total: number; label: string };
type DoneMsg = { type: 'done'; id: string; result: unknown };
type ErrorMsg = { type: 'error'; id: string; message: string };

interface StreamAssembly {
  op: string;
  totalSize: number;
  payload: Record<string, unknown>;
  chunks: Uint8Array[];
  received: number;
}

interface CompressSession {
  doc: PDFDocument;
  totalPages: number;
  receivedPages: number;
}

const streamAssemblies = new Map<string, StreamAssembly>();
const compressSessions = new Map<string, CompressSession>();

function postProgress(id: string, current: number, total: number, label: string) {
  const msg: ProgressMsg = { type: 'progress', id, current, total, label };
  self.postMessage(msg);
}

function postDone(id: string, result: unknown) {
  const msg: DoneMsg = { type: 'done', id, result };
  self.postMessage(msg);
}

function postError(id: string, message: string) {
  const msg: ErrorMsg = { type: 'error', id, message };
  self.postMessage(msg);
}

async function yieldToGc(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

/** Defensive save — avoids corrupt object-stream crashes on non-standard PDFs. */
async function savePdfWithCompressionFallback(doc: PDFDocument): Promise<Uint8Array> {
  try {
    return await doc.save({ useObjectStreams: false });
  } catch (error) {
    console.warn('Aggressive byte strip failed, falling back.', error);
    return await doc.save();
  }
}

function purgeStreamAssembly(id: string): void {
  const assembly = streamAssemblies.get(id);
  if (!assembly) return;
  assembly.chunks.length = 0;
  streamAssemblies.delete(id);
}

function purgeCompressSession(id: string): void {
  compressSessions.delete(id);
}

async function finalizeStreamAssembly(id: string): Promise<void> {
  const assembly = streamAssemblies.get(id);
  if (!assembly) throw new Error('Stream assembly not found');

  const { op, totalSize, payload, chunks } = assembly;
  streamAssemblies.delete(id);

  postProgress(id, 0, 1, 'Assembling streamed input…');
  const buffer = assembleChunks(chunks, totalSize);
  await yieldToGc();

  try {
    const result = await dispatchOperation(id, op, { ...payload, buffer: buffer.buffer });
    postDone(id, result);
  } finally {
    buffer.fill(0);
    await yieldToGc();
  }
}

async function mergePdfs(id: string, buffers: ArrayBuffer[]) {
  const merged = await PDFDocument.create();
  for (let i = 0; i < buffers.length; i++) {
    postProgress(id, i, buffers.length, `Merging file ${i + 1} of ${buffers.length}…`);
    let srcBuffer: ArrayBuffer | null = buffers[i];
    const doc = await PDFDocument.load(srcBuffer!);
    srcBuffer = null;
    buffers[i] = new ArrayBuffer(0);

    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
    await yieldToGc();
  }
  buffers.length = 0;

  postProgress(id, 1, 1, 'Finalizing merged PDF…');
  const output = await merged.save({ useObjectStreams: true });
  await yieldToGc();
  return output;
}

async function extractPages(id: string, buffer: ArrayBuffer, pageIndices: number[]) {
  let srcBuffer: ArrayBuffer | null = buffer;
  const source = await PDFDocument.load(srcBuffer!);
  srcBuffer = null;

  const out = await PDFDocument.create();
  postProgress(id, 0, pageIndices.length, 'Extracting selected pages…');

  for (let i = 0; i < pageIndices.length; i++) {
    const [page] = await out.copyPages(source, [pageIndices[i]]);
    out.addPage(page);
    postProgress(id, i + 1, pageIndices.length, `Extracting page ${i + 1} of ${pageIndices.length}…`);
    await yieldToGc();
  }

  const output = await out.save({ useObjectStreams: true });
  await yieldToGc();
  return output;
}

async function buildFromJpegs(id: string, jpegPages: Uint8Array[]) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < jpegPages.length; i++) {
    postProgress(id, i + 1, jpegPages.length, `Optimizing page ${i + 1} of ${jpegPages.length}…`);
    let pageBytes: Uint8Array | null = jpegPages[i];
    const embedded = await doc.embedJpg(pageBytes!);
    pageBytes = null;
    jpegPages[i] = new Uint8Array(0);

    const page = doc.addPage([embedded.width, embedded.height]);
    page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
    await yieldToGc();
  }
  jpegPages.length = 0;

  const output = await savePdfWithCompressionFallback(doc);
  await yieldToGc();
  return output;
}

async function initCompressSession(id: string, totalPages: number): Promise<void> {
  compressSessions.set(id, {
    doc: await PDFDocument.create(),
    totalPages,
    receivedPages: 0,
  });
}

async function appendCompressPage(id: string, jpegBuffer: ArrayBuffer): Promise<void> {
  const session = compressSessions.get(id);
  if (!session) throw new Error('Compression session not found');

  let jpegBytes: Uint8Array | null = new Uint8Array(jpegBuffer);
  const embedded = await docEmbedJpgSafe(session.doc, jpegBytes);
  jpegBytes = null;

  const page = session.doc.addPage([embedded.width, embedded.height]);
  page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
  session.receivedPages += 1;

  postProgress(
    id,
    session.receivedPages,
    session.totalPages,
    `Optimizing page ${session.receivedPages} of ${session.totalPages}…`
  );
  await yieldToGc();
}

async function finalizeCompressSession(id: string): Promise<Uint8Array> {
  const session = compressSessions.get(id);
  if (!session) throw new Error('Compression session not found');

  compressSessions.delete(id);
  postProgress(id, session.totalPages, session.totalPages, 'Finalizing compressed PDF…');
  const output = await savePdfWithCompressionFallback(session.doc);
  await yieldToGc();
  return output;
}

async function docEmbedJpgSafe(doc: PDFDocument, bytes: Uint8Array) {
  try {
    return await doc.embedJpg(bytes);
  } catch {
    return await doc.embedJpg(TINY_JPEG);
  }
}

/**
 * Extreme compression: bytecode sanitizer strips metadata/history and heavy image
 * stream headers, then rebuilds the document page-by-page without canvas re-encode.
 */
async function compressExtremeBytecode(id: string, buffer: ArrayBuffer): Promise<Uint8Array> {
  postProgress(id, 0, 4, 'Stripping document metadata overhead…');

  let rawBytes: Uint8Array | null = new Uint8Array(buffer);
  let sanitized = sanitizePdfForExtremeCompression(rawBytes);
  rawBytes = null;
  await yieldToGc();

  postProgress(id, 1, 4, 'Loading sanitized structure…');
  let loadBytes: Uint8Array | null = sanitized;
  sanitized = new Uint8Array(0);

  let source: PDFDocument | null = null;
  try {
    source = await PDFDocument.load(loadBytes!, { ignoreEncryption: true });
  } catch {
    source = await PDFDocument.load(new Uint8Array(buffer), { ignoreEncryption: true });
  }
  loadBytes = null;
  await yieldToGc();

  const pageCount = source.getPageCount();
  const out = await PDFDocument.create();

  postProgress(id, 2, 4, 'Rebuilding pages without heavy XObject history…');
  for (let i = 0; i < pageCount; i++) {
    const [page] = await out.copyPages(source!, [i]);
    out.addPage(page);
    if (i % 3 === 2) await yieldToGc();
    postProgress(id, 2 + Math.floor((i / pageCount) * 1), 4, `Processing page ${i + 1} of ${pageCount}…`);
  }
  source = null;
  await yieldToGc();

  postProgress(id, 3, 4, 'Writing optimized output…');
  let output: Uint8Array;
  try {
    output = await out.save({ useObjectStreams: false, addDefaultPage: false });
  } catch (error) {
    console.warn('Aggressive byte strip failed, falling back.', error);
    output = await out.save({ addDefaultPage: false });
  }
  await yieldToGc();
  return output;
}

async function imagesToPdf(
  id: string,
  images: { bytes: Uint8Array; kind: 'jpg' | 'png' }[]
) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < images.length; i++) {
    postProgress(id, i + 1, images.length, `Building page ${i + 1} of ${images.length}…`);
    let { bytes, kind } = images[i];
    const embedded =
      kind === 'png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    bytes = new Uint8Array(0);
    images[i] = { bytes: new Uint8Array(0), kind: 'jpg' };

    const page = doc.addPage([embedded.width, embedded.height]);
    page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
    await yieldToGc();
  }
  images.length = 0;

  const output = await doc.save({ useObjectStreams: true });
  await yieldToGc();
  return output;
}

async function removePages(id: string, buffer: ArrayBuffer, removeIndices: number[]) {
  const source = await PDFDocument.load(buffer);
  const total = source.getPageCount();
  const keep = [...Array(total).keys()].filter((i) => !removeIndices.includes(i));
  const out = await PDFDocument.create();
  const copied = await out.copyPages(source, keep);
  copied.forEach((p) => out.addPage(p));
  postProgress(id, 1, 1, 'Saving cleaned PDF…');
  return out.save({ useObjectStreams: true });
}

async function rotateAll(id: string, buffer: ArrayBuffer, angle: 90 | 180 | 270) {
  const doc = await PDFDocument.load(buffer);
  const pages = doc.getPages();
  for (let i = 0; i < pages.length; i++) {
    postProgress(id, i + 1, pages.length, `Rotating page ${i + 1} of ${pages.length}…`);
    pages[i].setRotation(degrees(angle));
  }
  return doc.save({ useObjectStreams: true });
}

async function rotatePages(
  id: string,
  buffer: ArrayBuffer,
  pageRotations: { pageIndex: number; angle: 0 | 90 | 180 | 270 }[]
) {
  const doc = await PDFDocument.load(buffer);
  const pages = doc.getPages();
  const rotations = pageRotations.filter((r) => r.angle > 0);
  for (let i = 0; i < rotations.length; i++) {
    const { pageIndex, angle } = rotations[i];
    postProgress(id, i + 1, rotations.length, `Rotating page ${pageIndex + 1}…`);
    if (pages[pageIndex]) {
      pages[pageIndex].setRotation(degrees(angle));
    }
    await yieldToGc();
  }
  return doc.save({ useObjectStreams: true });
}

async function reorderPages(id: string, buffer: ArrayBuffer, order: number[]) {
  const source = await PDFDocument.load(buffer);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(source, order);
  copied.forEach((p) => out.addPage(p));
  return out.save({ useObjectStreams: true });
}

function standardFontForFamily(family: WatermarkFontFamily, bold = false) {
  switch (family) {
    case 'Times Roman':
      return bold ? StandardFonts.TimesRomanBold : StandardFonts.TimesRoman;
    case 'Courier':
      return bold ? StandardFonts.CourierBold : StandardFonts.Courier;
    default:
      return bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica;
  }
}

interface WatermarkOptions {
  mode: 'text' | 'image';
  text?: string;
  color?: string;
  fontSize?: number;
  fontFamily?: WatermarkFontFamily;
  imageBytes?: ArrayBuffer;
  imageKind?: 'png' | 'jpg';
  imageScale?: number;
  position?: OverlayPosition;
  offsetX?: number;
  offsetY?: number;
  rotation?: number;
  opacity?: number;
  layer?: WatermarkLayer;
}

/** Solid white backing — prevents alpha premultiply over null page color in some viewers. */
function fillPageWhite(page: PDFPage): void {
  const { width, height } = page.getSize();
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(1, 1, 1),
  });
}

async function drawTextWatermark(
  page: PDFPage,
  doc: PDFDocument,
  opts: WatermarkOptions
) {
  const text = opts.text ?? '';
  const fontSize = opts.fontSize ?? 36;
  const font = await doc.embedFont(standardFontForFamily(opts.fontFamily ?? 'Helvetica', true));
  const { width, height } = page.getSize();
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const { x: boxX, y: boxY } = overlayPositionToPdfCoords(
    opts.position ?? 'center',
    width,
    height,
    textWidth,
    fontSize,
    { offsetX: opts.offsetX, offsetY: opts.offsetY }
  );
  const cssRotation = opts.rotation ?? 0;
  const cx = boxX + textWidth / 2;
  const cy = boxY + fontSize / 2;
  const { x, y } = bottomLeftForCenterRotation(cx, cy, textWidth, fontSize, cssRotation);
  const c = hexToRgb01(opts.color ?? '#064e3b');
  page.drawText(text, {
    x,
    y,
    size: fontSize,
    font,
    color: rgb(c.r, c.g, c.b),
    opacity: opts.opacity ?? 0.2,
    rotate: degrees(cssRotationToPdfDegrees(cssRotation)),
  });
}

async function drawImageWatermark(
  page: PDFPage,
  doc: PDFDocument,
  opts: WatermarkOptions
) {
  if (!opts.imageBytes) throw new Error('Image bytes required for logo watermark');
  const bytes = new Uint8Array(opts.imageBytes);
  const image =
    opts.imageKind === 'jpg' ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
  const { width: pageW, height: pageH } = page.getSize();
  const scale = (opts.imageScale ?? 35) / 100;
  const imgW = pageW * scale;
  const imgH = imgW * (image.height / image.width);
  const { x: boxX, y: boxY } = overlayPositionToPdfCoords(
    opts.position ?? 'center',
    pageW,
    pageH,
    imgW,
    imgH,
    { offsetX: opts.offsetX, offsetY: opts.offsetY }
  );
  const cssRotation = opts.rotation ?? 0;
  const cx = boxX + imgW / 2;
  const cy = boxY + imgH / 2;
  const { x, y } = bottomLeftForCenterRotation(cx, cy, imgW, imgH, cssRotation);
  page.drawImage(image, {
    x,
    y,
    width: imgW,
    height: imgH,
    opacity: opts.opacity ?? 0.2,
    rotate: degrees(cssRotationToPdfDegrees(cssRotation)),
    blendMode: BlendMode.Normal,
  });
}

async function applyWatermarkLayer(
  doc: PDFDocument,
  pageIndex: number,
  opts: WatermarkOptions
) {
  const layer = opts.layer ?? 'over';
  const pages = doc.getPages();
  const page = pages[pageIndex];
  if (!page) return;

  const draw = async (target: PDFPage) => {
    if (opts.mode === 'image') await drawImageWatermark(target, doc, opts);
    else await drawTextWatermark(target, doc, opts);
  };

  if (layer === 'over') {
    await draw(page);
    return;
  }

  const { width, height } = page.getSize();
  const embedded = await doc.embedPage(page);
  doc.removePage(pageIndex);
  const newPage = doc.insertPage(pageIndex, [width, height]);
  fillPageWhite(newPage);
  await draw(newPage);
  newPage.drawPage(embedded, {
    x: 0,
    y: 0,
    width,
    height,
    blendMode: BlendMode.Multiply,
  });
}

async function addPageNumbers(
  id: string,
  buffer: ArrayBuffer,
  vertical: PageNumberVertical = 'bottom',
  horizontal: PageNumberHorizontal = 'center',
  options: {
    format?: PageNumberFormat;
    color?: string;
    fontSize?: number;
    fontFamily?: WatermarkFontFamily;
    margins?: OverlayMargins;
    offsetX?: number;
    offsetY?: number;
  } = {}
) {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const size = options.fontSize ?? 11;
  const font = await doc.embedFont(standardFontForFamily(options.fontFamily ?? 'Helvetica'));
  const c = hexToRgb01(options.color ?? '#333333');
  const pages = doc.getPages();
  const total = pages.length;

  for (let i = 0; i < pages.length; i++) {
    postProgress(id, i + 1, pages.length, `Numbering page ${i + 1} of ${pages.length}…`);
    const page = pages[i];
    const { width, height } = page.getSize();
    const label = formatPageNumber(options.format ?? 'plain', i + 1, total);
    const textWidth = font.widthOfTextAtSize(label, size);
    const { x, y } = pageNumberPlacementToPdfCoords(
      vertical,
      horizontal,
      width,
      height,
      textWidth,
      size,
      {
        margins: options.margins,
        offsetX: options.offsetX,
        offsetY: options.offsetY,
      }
    );
    page.drawText(label, {
      x,
      y,
      size,
      font,
      color: rgb(c.r, c.g, c.b),
    });
  }
  return doc.save({ useObjectStreams: true });
}

async function watermark(id: string, buffer: ArrayBuffer, opts: WatermarkOptions) {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const pages = doc.getPages();
  const layer = opts.layer ?? 'over';

  if (layer === 'under') {
    for (let i = pages.length - 1; i >= 0; i--) {
      postProgress(id, pages.length - i, pages.length, `Watermarking page ${i + 1} of ${pages.length}…`);
      await applyWatermarkLayer(doc, i, opts);
      await yieldToGc();
    }
  } else {
    for (let i = 0; i < pages.length; i++) {
      postProgress(id, i + 1, pages.length, `Watermarking page ${i + 1} of ${pages.length}…`);
      await applyWatermarkLayer(doc, i, opts);
      await yieldToGc();
    }
  }

  return doc.save({ useObjectStreams: true });
}

async function repairPdf(id: string, buffer: ArrayBuffer) {
  postProgress(id, 1, 2, 'Repairing document structure…');
  const source = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const indices = source.getPageIndices();
  for (let i = 0; i < indices.length; i++) {
    const [page] = await out.copyPages(source, [indices[i]]);
    out.addPage(page);
    await yieldToGc();
  }
  postProgress(id, 2, 2, 'Saving repaired PDF…');
  return out.save({ useObjectStreams: true });
}

async function organizePages(
  id: string,
  buffer: ArrayBuffer,
  orderedIndices: number[],
  rotations: { pageIndex: number; angle: 0 | 90 | 180 | 270 }[]
) {
  const source = await PDFDocument.load(buffer);
  const out = await PDFDocument.create();
  const rotMap = new Map(rotations.map((r) => [r.pageIndex, r.angle]));

  for (let i = 0; i < orderedIndices.length; i++) {
    const srcIdx = orderedIndices[i];
    postProgress(id, i + 1, orderedIndices.length, `Organizing page ${i + 1} of ${orderedIndices.length}…`);
    const [page] = await out.copyPages(source, [srcIdx]);
    const angle = rotMap.get(srcIdx) ?? 0;
    if (angle) page.setRotation(degrees(angle));
    out.addPage(page);
    await yieldToGc();
  }

  return out.save({ useObjectStreams: true });
}

async function applySignature(
  id: string,
  buffer: ArrayBuffer,
  pageIndex: number,
  pngBytes: Uint8Array,
  placement: { x: number; y: number; width: number; height: number }
) {
  postProgress(id, 1, 2, 'Embedding signature…');
  const doc = await PDFDocument.load(buffer);
  const page = doc.getPages()[pageIndex];
  if (!page) throw new Error('Page not found');

  const image = await doc.embedPng(pngBytes);
  page.drawImage(image, {
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height,
  });

  postProgress(id, 2, 2, 'Flattening signed PDF…');
  return doc.save({ useObjectStreams: true });
}

async function cropPdfPage(
  id: string,
  buffer: ArrayBuffer,
  pageIndex: number,
  crop: { x: number; y: number; width: number; height: number }
) {
  postProgress(id, 1, 1, 'Applying crop box…');
  const doc = await PDFDocument.load(buffer);
  const page = doc.getPages()[pageIndex];
  if (!page) throw new Error('Page not found');

  page.setCropBox(crop.x, crop.y, crop.width, crop.height);
  page.setMediaBox(crop.x, crop.y, crop.width, crop.height);
  return doc.save({ useObjectStreams: true });
}

async function unlockPdf(id: string, buffer: ArrayBuffer, password: string) {
  postProgress(id, 1, 3, 'Decrypting document…');
  const source = await PDFDocument.load(buffer, { password });
  postProgress(id, 2, 3, 'Stripping security envelope…');
  const out = await PDFDocument.create();
  const indices = source.getPageIndices();
  const copied = await out.copyPages(source, indices);
  copied.forEach((p) => out.addPage(p));
  postProgress(id, 3, 3, 'Saving unlocked PDF…');
  return out.save({ useObjectStreams: true });
}

interface ProtectRestrictions {
  disablePrinting?: boolean;
  disableCopying?: boolean;
  disableModifying?: boolean;
  disableAnnotating?: boolean;
}

async function protectPdf(
  id: string,
  buffer: ArrayBuffer,
  userPassword: string,
  ownerPassword: string,
  restrictions: ProtectRestrictions = {}
) {
  postProgress(id, 1, 2, 'Loading document…');
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  postProgress(id, 2, 2, 'Applying AES encryption…');
  doc.encrypt({
    userPassword,
    ownerPassword: ownerPassword || userPassword,
    permissions: {
      printing: restrictions.disablePrinting ? undefined : 'highResolution',
      modifying: restrictions.disableModifying !== false ? false : true,
      copying: restrictions.disableCopying !== false ? false : true,
      annotating: restrictions.disableAnnotating !== false ? false : true,
      fillingForms: false,
      contentAccessibility: false,
      documentAssembly: false,
    },
  });
  return doc.save({ useObjectStreams: true });
}

async function stripPdfMetadata(id: string, buffer: ArrayBuffer) {
  postProgress(id, 1, 3, 'Reading document…');
  const source = await PDFDocument.load(buffer, { ignoreEncryption: true });

  postProgress(id, 2, 3, 'Rebuilding without metadata…');
  const out = await PDFDocument.create();
  const indices = source.getPageIndices();
  const copied = await out.copyPages(source, indices);
  copied.forEach((page) => out.addPage(page));

  out.setTitle('');
  out.setAuthor('');
  out.setSubject('');
  out.setKeywords([]);
  out.setCreator('');
  out.setProducer('');

  postProgress(id, 3, 3, 'Sanitizing hidden document fields…');
  let bytes = await out.save({ useObjectStreams: true });
  bytes = sanitizePdfForExtremeCompression(bytes);
  await yieldToGc();
  return bytes;
}

async function splitAllPages(id: string, buffer: ArrayBuffer): Promise<Uint8Array[]> {
  const source = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const indices = source.getPageIndices();
  const outputs: Uint8Array[] = [];

  for (let i = 0; i < indices.length; i++) {
    postProgress(id, i + 1, indices.length, `Splitting page ${i + 1} of ${indices.length}…`);
    const out = await PDFDocument.create();
    const [page] = await out.copyPages(source, [indices[i]]);
    out.addPage(page);
    outputs.push(await out.save({ useObjectStreams: true }));
    await yieldToGc();
  }

  return outputs;
}

async function pageCountFromBuffer(buffer: ArrayBuffer): Promise<{ pageCount: number }> {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  return { pageCount: doc.getPageCount() };
}

async function dispatchOperation(
  id: string,
  op: string,
  payload: Record<string, unknown>
): Promise<unknown> {
  switch (op) {
    case 'merge':
      return mergePdfs(id, payload.buffers as ArrayBuffer[]);
    case 'extract':
      return extractPages(id, payload.buffer as ArrayBuffer, payload.pageIndices as number[]);
    case 'from-jpegs':
      return buildFromJpegs(id, payload.jpegPages as Uint8Array[]);
    case 'compress-extreme':
      return compressExtremeBytecode(id, payload.buffer as ArrayBuffer);
    case 'page-count':
      return pageCountFromBuffer(payload.buffer as ArrayBuffer);
    case 'images-to-pdf':
      return imagesToPdf(id, payload.images as { bytes: Uint8Array; kind: 'jpg' | 'png' }[]);
    case 'remove-pages':
      return removePages(id, payload.buffer as ArrayBuffer, payload.removeIndices as number[]);
    case 'rotate-all':
      return rotateAll(id, payload.buffer as ArrayBuffer, payload.angle as 90 | 180 | 270);
    case 'rotate-pages':
      return rotatePages(
        id,
        payload.buffer as ArrayBuffer,
        payload.pageRotations as { pageIndex: number; angle: 0 | 90 | 180 | 270 }[]
      );
    case 'reorder-pages':
      return reorderPages(id, payload.buffer as ArrayBuffer, payload.order as number[]);
    case 'add-page-numbers':
      return addPageNumbers(
        id,
        payload.buffer as ArrayBuffer,
        (payload.vertical as PageNumberVertical) ?? 'bottom',
        (payload.horizontal as PageNumberHorizontal) ?? 'center',
        {
          format: payload.format as PageNumberFormat | undefined,
          color: payload.color as string | undefined,
          fontSize: payload.fontSize as number | undefined,
          fontFamily: payload.fontFamily as WatermarkFontFamily | undefined,
          margins: payload.margins as OverlayMargins | undefined,
          offsetX: payload.offsetX as number | undefined,
          offsetY: payload.offsetY as number | undefined,
        }
      );
    case 'watermark':
      return watermark(id, payload.buffer as ArrayBuffer, {
        mode: (payload.mode as 'text' | 'image') ?? 'text',
        text: payload.text as string | undefined,
        color: payload.color as string | undefined,
        fontSize: payload.fontSize as number | undefined,
        fontFamily: payload.fontFamily as WatermarkFontFamily | undefined,
        imageBytes: payload.imageBytes as ArrayBuffer | undefined,
        imageKind: payload.imageKind as 'png' | 'jpg' | undefined,
        imageScale: payload.imageScale as number | undefined,
        position: (payload.position as OverlayPosition) ?? 'center',
        offsetX: payload.offsetX as number | undefined,
        offsetY: payload.offsetY as number | undefined,
        rotation: payload.rotation as number | undefined,
        opacity: payload.opacity as number | undefined,
        layer: payload.layer as WatermarkLayer | undefined,
      });
    case 'repair':
      return repairPdf(id, payload.buffer as ArrayBuffer);
    case 'organize-pages':
      return organizePages(
        id,
        payload.buffer as ArrayBuffer,
        payload.orderedIndices as number[],
        payload.rotations as { pageIndex: number; angle: 0 | 90 | 180 | 270 }[]
      );
    case 'sign-pdf':
      return applySignature(
        id,
        payload.buffer as ArrayBuffer,
        payload.pageIndex as number,
        new Uint8Array(payload.pngBytes as ArrayBuffer),
        payload.placement as { x: number; y: number; width: number; height: number }
      );
    case 'crop-pdf':
      return cropPdfPage(
        id,
        payload.buffer as ArrayBuffer,
        payload.pageIndex as number,
        payload.crop as { x: number; y: number; width: number; height: number }
      );
    case 'unlock-pdf':
      return unlockPdf(id, payload.buffer as ArrayBuffer, payload.password as string);
    case 'protect-pdf':
      return protectPdf(
        id,
        payload.buffer as ArrayBuffer,
        payload.userPassword as string,
        payload.ownerPassword as string,
        (payload.restrictions as ProtectRestrictions) ?? {}
      );
    case 'strip-metadata':
      return stripPdfMetadata(id, payload.buffer as ArrayBuffer);
    case 'split-all-pages':
      return splitAllPages(id, payload.buffer as ArrayBuffer);
    default:
      throw new Error(`Unknown worker operation: ${op}`);
  }
}

self.onmessage = async (event: MessageEvent) => {
  const msg = event.data as Record<string, unknown>;
  const id = msg.id as string;

  try {
    if (msg.type === 'stream-start') {
      streamAssemblies.set(id, {
        op: msg.op as string,
        totalSize: msg.totalSize as number,
        payload: (msg.payload as Record<string, unknown>) ?? {},
        chunks: [],
        received: 0,
      });
      return;
    }

    if (msg.type === 'stream-chunk') {
      const assembly = streamAssemblies.get(id);
      if (!assembly) throw new Error('Unexpected stream chunk');
      assembly.chunks.push(new Uint8Array(msg.chunk as ArrayBuffer));
      assembly.received += (msg.chunk as ArrayBuffer).byteLength;
      postProgress(id, assembly.received, assembly.totalSize, 'Receiving file stream…');
      return;
    }

    if (msg.type === 'stream-end') {
      await finalizeStreamAssembly(id);
      return;
    }

    const op = msg.op as string;

    if (op === 'compress-init') {
      await initCompressSession(id, (msg.payload as { totalPages: number }).totalPages);
      return;
    }

    if (op === 'compress-page') {
      const { jpeg } = msg.payload as { jpeg: ArrayBuffer };
      await appendCompressPage(id, jpeg);
      return;
    }

    if (op === 'compress-finalize') {
      const result = await finalizeCompressSession(id);
      postDone(id, result);
      return;
    }

    const result = await dispatchOperation(id, op, (msg.payload as Record<string, unknown>) ?? {});
    postDone(id, result);
  } catch (err) {
    purgeStreamAssembly(id);
    purgeCompressSession(id);
    postError(id, err instanceof Error ? err.message : 'Worker processing failed');
  }
};
