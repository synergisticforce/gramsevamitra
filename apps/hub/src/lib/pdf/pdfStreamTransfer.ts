import { assertSupportedFileSize, yieldToGc } from './pdfMemory';

export const STREAM_CHUNK_SIZE = 2 * 1024 * 1024;

export type StreamProgress = (loaded: number, total: number) => void;

export async function readFileInChunks(
  file: File | Blob,
  onChunk: (chunk: Uint8Array, offset: number, total: number) => void | Promise<void>,
  onProgress?: StreamProgress
): Promise<number> {
  assertSupportedFileSize(file.size);
  const total = file.size;
  const reader = (file.stream() as unknown as ReadableStream<Uint8Array>).getReader();
  let offset = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    const chunk =
      value.byteLength === value.buffer.byteLength ? value : value.slice();

    await onChunk(chunk, offset, total);
    offset += chunk.byteLength;
    onProgress?.(offset, total);
    await yieldToGc();
  }

  return offset;
}

export function assembleChunks(chunks: Uint8Array[], totalSize: number): Uint8Array {
  const out = new Uint8Array(totalSize);
  let offset = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    out.set(chunk, offset);
    offset += chunk.byteLength;
    chunks[i] = new Uint8Array(0);
  }
  chunks.length = 0;
  return out;
}
