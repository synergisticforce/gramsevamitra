import { PDFDocument } from 'pdf-lib';
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

const streamAssemblies = new Map<string, StreamAssembly>();

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

function purgeStreamAssembly(id: string): void {
  const assembly = streamAssemblies.get(id);
  if (!assembly) return;
  assembly.chunks.length = 0;
  streamAssemblies.delete(id);
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
    const result = await dispatchOperation(id, op, (msg.payload as Record<string, unknown>) ?? {});
    postDone(id, result);
  } catch (err) {
    purgeStreamAssembly(id);
    postError(id, err instanceof Error ? err.message : 'Worker processing failed');
  }
};
