import { assertSupportedFileSize } from './pdfMemory';
import { readFileInChunks } from './pdfStreamTransfer';

export type PdfWorkerProgress = { current: number; total: number; label: string };

type WorkerOutbound =
  | { id: string; op: string; payload: Record<string, unknown> }
  | { type: 'stream-start'; id: string; op: string; totalSize: number; payload: Record<string, unknown> }
  | { type: 'stream-chunk'; id: string; chunk: ArrayBuffer }
  | { type: 'stream-end'; id: string };

type WorkerInbound = {
  id: string;
  type: 'progress' | 'done' | 'error';
  current?: number;
  total?: number;
  label?: string;
  result?: unknown;
  message?: string;
};

let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../../workers/pdfCanvas.worker.ts', import.meta.url), {
      type: 'module',
    });
  }
  return worker;
}

function attachWorkerPromise<T>(
  w: Worker,
  id: string,
  onProgress?: (progress: PdfWorkerProgress) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const handler = (event: MessageEvent) => {
      const data = event.data as WorkerInbound;
      if (data.id !== id) return;

      if (data.type === 'progress' && onProgress) {
        onProgress({
          current: data.current ?? 0,
          total: data.total ?? 1,
          label: data.label ?? 'Processing…',
        });
      }

      if (data.type === 'done') {
        w.removeEventListener('message', handler);
        resolve(data.result as T);
      }

      if (data.type === 'error') {
        w.removeEventListener('message', handler);
        reject(new Error(data.message ?? 'Worker failed'));
      }
    };

    w.addEventListener('message', handler);
  });
}

export function runPdfWorker<T = Uint8Array>(
  op: string,
  payload: Record<string, unknown>,
  onProgress?: (progress: PdfWorkerProgress) => void
): Promise<T> {
  const id = crypto.randomUUID();
  const w = getWorker();
  const promise = attachWorkerPromise<T>(w, id, onProgress);
  w.postMessage({ id, op, payload } satisfies WorkerOutbound);
  return promise;
}

export async function runPdfWorkerWithStreamedFile<T = Uint8Array>(
  op: string,
  file: File | Blob,
  payload: Record<string, unknown> = {},
  onProgress?: (progress: PdfWorkerProgress) => void
): Promise<T> {
  assertSupportedFileSize(file.size);
  const id = crypto.randomUUID();
  const w = getWorker();
  const promise = attachWorkerPromise<T>(w, id, onProgress);

  w.postMessage({
    type: 'stream-start',
    id,
    op,
    totalSize: file.size,
    payload,
  } satisfies WorkerOutbound);

  await readFileInChunks(
    file,
    (chunk) => {
      const transferable = chunk.buffer.slice(
        chunk.byteOffset,
        chunk.byteOffset + chunk.byteLength
      );
      w.postMessage({ type: 'stream-chunk', id, chunk: transferable }, [transferable]);
    },
    (loaded, total) => {
      onProgress?.({
        current: loaded,
        total,
        label: `Streaming input… ${Math.round((loaded / total) * 100)}%`,
      });
    }
  );

  w.postMessage({ type: 'stream-end', id } satisfies WorkerOutbound);
  return promise;
}

export async function getPdfPageCountFromFile(file: File | Blob): Promise<number> {
  const result = await runPdfWorkerWithStreamedFile<{ pageCount: number }>('page-count', file);
  return result.pageCount;
}

/** Stream JPEG pages one at a time — only one page buffer lives in memory per step. */
export async function runPdfWorkerWithJpegPages<T = Uint8Array>(
  totalPages: number,
  pageProducer: (pageIndex: number) => Promise<Uint8Array>,
  onProgress?: (progress: PdfWorkerProgress) => void
): Promise<T> {
  const id = crypto.randomUUID();
  const w = getWorker();
  const promise = attachWorkerPromise<T>(w, id, onProgress);

  w.postMessage({ id, op: 'compress-init', payload: { totalPages } });

  for (let i = 0; i < totalPages; i++) {
    onProgress?.({
      current: i,
      total: totalPages,
      label: `Sending page ${i + 1} of ${totalPages}…`,
    });

    let jpegBytes = await pageProducer(i);
    const transferable = jpegBytes.buffer.slice(
      jpegBytes.byteOffset,
      jpegBytes.byteOffset + jpegBytes.byteLength
    );
    w.postMessage(
      { id, op: 'compress-page', payload: { pageIndex: i, jpeg: transferable } },
      [transferable]
    );
    jpegBytes = new Uint8Array(0);
  }

  w.postMessage({ id, op: 'compress-finalize', payload: {} });
  return promise;
}
