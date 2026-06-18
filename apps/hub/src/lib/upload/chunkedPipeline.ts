import { downloadBlob } from '@shared/utils/fileUtils';
import { getLocalProcessingLimitBytes } from '../pdf/deviceDetection';

export const CHUNK_BYTES = 20 * 1024 * 1024;

/** @deprecated Use getLocalProcessingLimitBytes() — device-aware (50MB mobile, 1GB desktop). */
export const SAFE_LOCAL_BYTES = 50 * 1024 * 1024;

export interface ChunkProgress {
  label: string;
  percent: number;
}

export interface ChunkSessionInit {
  sessionId: string;
  totalChunks: number;
  chunkBytes: number;
  expiresAt: string;
}

interface SessionInitResponse extends Partial<ChunkSessionInit> {
  success?: boolean;
  message?: string;
}

interface UploadChunkResponse {
  success?: boolean;
  uploadedCount?: number;
  totalChunks?: number;
  message?: string;
}

interface FinalizeStageResponse {
  success?: boolean;
  objectKey?: string;
  fileName?: string;
  contentType?: string;
  fileSize?: number;
  message?: string;
}

export function shouldUseChunkedPipeline(file: File): boolean {
  return file.size > getLocalProcessingLimitBytes();
}

function totalChunksForFile(file: File, chunkBytes: number): number {
  return Math.ceil(file.size / chunkBytes);
}

async function createChunkSession(file: File, chunkBytes: number): Promise<ChunkSessionInit> {
  const response = await fetch('/api/chunked/session', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      fileSize: file.size,
      chunkBytes,
      totalChunks: totalChunksForFile(file, chunkBytes),
    }),
  });

  const payload = (await response.json()) as SessionInitResponse;
  if (!response.ok || !payload.success || !payload.sessionId || !payload.totalChunks) {
    throw new Error(payload.message || 'Failed to start chunked upload session.');
  }

  return {
    sessionId: payload.sessionId,
    totalChunks: payload.totalChunks,
    chunkBytes: payload.chunkBytes || chunkBytes,
    expiresAt: payload.expiresAt || '',
  };
}

async function uploadOneChunk(
  sessionId: string,
  index: number,
  chunk: Blob,
): Promise<UploadChunkResponse> {
  const response = await fetch(
    `/api/chunked/session?sessionId=${encodeURIComponent(sessionId)}&index=${index}&chunkSize=${chunk.size}`,
    {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: chunk,
    },
  );

  const payload = (await response.json()) as UploadChunkResponse;
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || `Failed to upload chunk ${index + 1}.`);
  }
  return payload;
}

export async function uploadFileInChunks(
  file: File,
  onProgress: (progress: ChunkProgress) => void,
  chunkBytes = CHUNK_BYTES,
): Promise<ChunkSessionInit> {
  const session = await createChunkSession(file, chunkBytes);
  onProgress({ label: 'Chunk session ready…', percent: 5 });

  for (let index = 0; index < session.totalChunks; index += 1) {
    const start = index * session.chunkBytes;
    const end = Math.min(file.size, start + session.chunkBytes);
    const chunk = file.slice(start, end);

    await uploadOneChunk(session.sessionId, index, chunk);

    const percent = 8 + Math.round(((index + 1) / session.totalChunks) * 82);
    onProgress({
      label: `Uploading chunk ${index + 1} of ${session.totalChunks}…`,
      percent,
    });
  }

  onProgress({ label: 'Upload complete. Finalizing…', percent: 92 });
  return session;
}

export async function finalizeChunkedStage(sessionId: string): Promise<{
  objectKey: string;
  fileName: string;
  contentType: string;
}> {
  const response = await fetch('/api/chunked/finalize', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, mode: 'stage' }),
  });

  const payload = (await response.json()) as FinalizeStageResponse;
  if (!response.ok || !payload.success || !payload.objectKey) {
    throw new Error(payload.message || 'Failed to finalize staged upload.');
  }

  return {
    objectKey: payload.objectKey,
    fileName: payload.fileName || 'upload.bin',
    contentType: payload.contentType || 'application/octet-stream',
  };
}

export async function finalizeChunkedDownload(
  sessionId: string,
  fileNameFallback: string,
): Promise<{ blob: Blob; fileName: string }> {
  const response = await fetch('/api/chunked/finalize', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, mode: 'download' }),
  });

  if (!response.ok) {
    let message = 'Failed to finalize chunked file.';
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload.message) message = payload.message;
    } catch {
      // ignore json parse failure
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const fileName =
    response.headers.get('X-GSM-File-Name') ||
    response.headers
      .get('Content-Disposition')
      ?.match(/filename\*?=(?:UTF-8''|")?([^";]+)/)?.[1]
      ?.replace(/%20/g, ' ') ||
    fileNameFallback;

  return { blob, fileName: decodeURIComponent(fileName) };
}

export async function runChunkedRoundTripDownload(
  file: File,
  onProgress: (progress: ChunkProgress) => void,
): Promise<void> {
  const session = await uploadFileInChunks(file, onProgress);
  onProgress({ label: 'Streaming final file…', percent: 96 });
  const { blob, fileName } = await finalizeChunkedDownload(session.sessionId, file.name);
  downloadBlob(blob, fileName, '_chunked');
  onProgress({ label: 'Complete', percent: 100 });
}

export async function stageFileViaChunks(
  file: File,
  onProgress: (progress: ChunkProgress) => void,
): Promise<{ objectKey: string; fileName: string }> {
  const session = await uploadFileInChunks(file, onProgress);
  const staged = await finalizeChunkedStage(session.sessionId);
  onProgress({ label: 'Chunk upload staged in secure storage.', percent: 96 });
  return { objectKey: staged.objectKey, fileName: staged.fileName };
}

function headerFileName(response: Response, fallback: string): string {
  const direct = response.headers.get('X-GSM-File-Name');
  if (direct) return direct;
  const cd = response.headers.get('Content-Disposition') || '';
  const match = cd.match(/filename="([^"]+)"/);
  return match?.[1] || fallback;
}

export async function runChunkedSplitPipeline(
  file: File,
  rangeInput: string,
  onProgress: (progress: ChunkProgress) => void,
): Promise<void> {
  const staged = await stageFileViaChunks(file, onProgress);
  onProgress({ label: 'Splitting pages on backend…', percent: 97 });

  const response = await fetch('/api/chunked/document/split', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      objectKey: staged.objectKey,
      fileName: file.name,
      rangeInput,
    }),
  });

  if (!response.ok) {
    let message = 'Chunked split failed.';
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload.message) message = payload.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const fileName = headerFileName(response, `${file.name.replace(/\.pdf$/i, '')}_split.pdf`);
  downloadBlob(blob, fileName, '_split');
  onProgress({ label: 'Complete', percent: 100 });
}

export async function runChunkedMergePipeline(
  files: File[],
  onProgress: (progress: ChunkProgress) => void,
): Promise<void> {
  if (files.length < 2) {
    throw new Error('At least two files are required for merge.');
  }

  const stagedKeys: string[] = [];
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    onProgress({ label: `Staging file ${i + 1} of ${files.length}…`, percent: 5 });
    const staged = await stageFileViaChunks(file, ({ label, percent }) =>
      onProgress({
        label: `${label} (file ${i + 1}/${files.length})`,
        percent: Math.min(92, Math.round((i / files.length) * 80 + (percent * 0.8) / files.length)),
      }),
    );
    stagedKeys.push(staged.objectKey);
  }

  onProgress({ label: 'Merging files on backend…', percent: 96 });
  const response = await fetch('/api/chunked/document/merge', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      objectKeys: stagedKeys,
      fileName: files[0]?.name || 'merged.pdf',
    }),
  });

  if (!response.ok) {
    let message = 'Chunked merge failed.';
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload.message) message = payload.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const fileName = headerFileName(response, `${files[0].name.replace(/\.pdf$/i, '')}_merged.pdf`);
  downloadBlob(blob, fileName, '_merged');
  onProgress({ label: 'Complete', percent: 100 });
}

export const CHUNKED_RENDER_UNSUPPORTED_MESSAGE =
  'This tool needs browser rendering and cannot use Smart Slicing. On desktop, files up to 1GB process locally. Try Split or Remove Pages to work on a smaller section first.';

async function runChunkedDocumentProcess(
  file: File,
  operation: string,
  params: Record<string, unknown>,
  onProgress: (progress: ChunkProgress) => void,
): Promise<Response> {
  const staged = await stageFileViaChunks(file, onProgress);
  onProgress({ label: 'Processing on secure backend…', percent: 97 });

  const response = await fetch('/api/chunked/document/process', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      operation,
      objectKey: staged.objectKey,
      fileName: file.name,
      params,
    }),
  });

  if (!response.ok) {
    let message = 'Chunked processing failed.';
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload.message) message = payload.message;
    } catch {
      // ignore json parse failure
    }
    throw new Error(message);
  }

  return response;
}

async function downloadChunkedPdfResponse(
  response: Response,
  file: File,
  fallbackSuffix: string,
  downloadTag: string,
  onProgress: (progress: ChunkProgress) => void,
): Promise<void> {
  const blob = await response.blob();
  const fileName = headerFileName(response, `${file.name.replace(/\.pdf$/i, '')}${fallbackSuffix}.pdf`);
  downloadBlob(blob, fileName, downloadTag);
  onProgress({ label: 'Complete', percent: 100 });
}

export async function runChunkedCompressPipeline(
  file: File,
  preset: string,
  onProgress: (progress: ChunkProgress) => void,
): Promise<{ savingsPct: number }> {
  const response = await runChunkedDocumentProcess(file, 'compress', { preset }, onProgress);
  const savingsPct = Number(response.headers.get('X-GSM-Savings-Pct') || '0');
  await downloadChunkedPdfResponse(response, file, '_compressed', '_compressed', onProgress);
  return { savingsPct };
}

export async function runChunkedRemovePagesPipeline(
  file: File,
  rangeInput: string,
  onProgress: (progress: ChunkProgress) => void,
): Promise<{ removedCount: number }> {
  const response = await runChunkedDocumentProcess(
    file,
    'remove-pages',
    { rangeInput },
    onProgress,
  );
  const removedCount = Number(response.headers.get('X-GSM-Removed-Count') || '0');
  await downloadChunkedPdfResponse(response, file, '_pages-removed', '_pages-removed', onProgress);
  return { removedCount };
}

export async function runChunkedReorderPipeline(
  file: File,
  order: number[],
  onProgress: (progress: ChunkProgress) => void,
): Promise<void> {
  const response = await runChunkedDocumentProcess(file, 'reorder', { order }, onProgress);
  await downloadChunkedPdfResponse(response, file, '_reordered', '_reordered', onProgress);
}

export async function runChunkedRotatePipeline(
  file: File,
  pageRotations: { pageIndex: number; angle: number }[],
  onProgress: (progress: ChunkProgress) => void,
): Promise<{ rotatedCount: number }> {
  const response = await runChunkedDocumentProcess(file, 'rotate', { pageRotations }, onProgress);
  const rotatedCount = Number(response.headers.get('X-GSM-Rotated-Count') || '0');
  await downloadChunkedPdfResponse(response, file, '_rotated', '_rotated', onProgress);
  return { rotatedCount };
}

export async function runChunkedProtectPipeline(
  file: File,
  userPassword: string,
  ownerPassword: string | undefined,
  onProgress: (progress: ChunkProgress) => void,
): Promise<void> {
  const response = await runChunkedDocumentProcess(
    file,
    'protect',
    { userPassword, ownerPassword },
    onProgress,
  );
  await downloadChunkedPdfResponse(response, file, '_protected', '_protected', onProgress);
}

export async function runChunkedUnlockPipeline(
  file: File,
  password: string,
  onProgress: (progress: ChunkProgress) => void,
): Promise<void> {
  const response = await runChunkedDocumentProcess(file, 'unlock', { password }, onProgress);
  await downloadChunkedPdfResponse(response, file, '_unlocked', '_unlocked', onProgress);
}

export async function runChunkedWatermarkPipeline(
  file: File,
  options: { text: string; position: string; opacity: number; rotation: number },
  onProgress: (progress: ChunkProgress) => void,
): Promise<void> {
  const response = await runChunkedDocumentProcess(file, 'watermark', options, onProgress);
  await downloadChunkedPdfResponse(response, file, '_watermarked', '_watermarked', onProgress);
}

export async function runChunkedPageNumbersPipeline(
  file: File,
  options: {
    vertical: string;
    horizontal: string;
    format: string;
    fontSize: number;
    color: string;
    startNumber: number;
  },
  onProgress: (progress: ChunkProgress) => void,
): Promise<void> {
  const response = await runChunkedDocumentProcess(file, 'page-numbers', options, onProgress);
  await downloadChunkedPdfResponse(response, file, '_numbered', '_numbered', onProgress);
}

export async function runChunkedCropPipeline(
  file: File,
  pageIndex: number,
  crop: { x: number; y: number; width: number; height: number },
  onProgress: (progress: ChunkProgress) => void,
): Promise<void> {
  const response = await runChunkedDocumentProcess(
    file,
    'crop',
    { pageIndex, crop },
    onProgress,
  );
  await downloadChunkedPdfResponse(response, file, '_cropped', '_cropped', onProgress);
}

export async function runChunkedExtractTextPipeline(
  file: File,
  onProgress: (progress: ChunkProgress) => void,
): Promise<{ text: string; pageCount: number }> {
  const response = await runChunkedDocumentProcess(file, 'extract-text', {}, onProgress);
  const payload = (await response.json()) as { text?: string; pageCount?: number };
  onProgress({ label: 'Complete', percent: 100 });
  return {
    text: payload.text || '',
    pageCount: payload.pageCount || 0,
  };
}

