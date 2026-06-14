import { PDFDocument, type PDFDocument as PDFDocumentType } from 'pdf-lib';
import { sanitizePdfForExtremeCompression, TINY_JPEG } from '../lib/pdf/pdfByteSanitizer';
import { assembleChunks } from '../lib/pdf/pdfStreamTransfer';

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
  doc: PDFDocumentType;
  totalPages: number;
  receivedPages: number;
}

interface ProtectRestrictions {
  disablePrinting?: boolean;
  disableCopying?: boolean;
  disableModifying?: boolean;
  disableAnnotating?: boolean;
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

async function savePdfWithCompressionFallback(doc: PDFDocumentType): Promise<Uint8Array> {
  try {
    return await doc.save({ useObjectStreams: false });
  } catch {
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

async function mergePdfs(id: string, buffers: ArrayBuffer[]) {
  const merged = await PDFDocument.create();
  for (let i = 0; i < buffers.length; i++) {
    postProgress(id, i, buffers.length, `Merging file ${i + 1} of ${buffers.length}…`);
    let srcBuffer: ArrayBuffer | null = buffers[i];
    const doc = await PDFDocument.load(srcBuffer!, { ignoreEncryption: true });
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
  const source = await PDFDocument.load(srcBuffer!, { ignoreEncryption: true });
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

async function pageCountFromBuffer(buffer: ArrayBuffer): Promise<{ pageCount: number }> {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  return { pageCount: doc.getPageCount() };
}

async function docEmbedJpgSafe(doc: PDFDocumentType, bytes: Uint8Array) {
  try {
    return await doc.embedJpg(bytes);
  } catch {
    return await doc.embedJpg(TINY_JPEG);
  }
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
    case 'page-count':
      return pageCountFromBuffer(payload.buffer as ArrayBuffer);
    case 'strip-metadata':
      return stripPdfMetadata(id, payload.buffer as ArrayBuffer);
    case 'protect-pdf':
      return protectPdf(
        id,
        payload.buffer as ArrayBuffer,
        payload.userPassword as string,
        payload.ownerPassword as string,
        (payload.restrictions as ProtectRestrictions) ?? {}
      );
    default:
      throw new Error(`Unknown worker operation: ${op}`);
  }
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
