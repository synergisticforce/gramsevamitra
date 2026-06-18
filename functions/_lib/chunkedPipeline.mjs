import { sanitizeProFilename } from './proTransientStorage.mjs';

export const CHUNK_BYTES = 20 * 1024 * 1024;
export const SAFE_LOCAL_BYTES = 50 * 1024 * 1024;
export const MAX_CHUNKS = 320; // 6.4 GB at 20 MB/chunk
export const SESSION_TTL_MS = 30 * 60 * 1000;

const SESSION_PREFIX = 'chunked/v1';

function safePositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

export function buildSessionId() {
  return crypto.randomUUID();
}

export function buildSessionPrefix(sessionId) {
  return `${SESSION_PREFIX}/${sessionId}`;
}

export function buildManifestKey(sessionId) {
  return `${buildSessionPrefix(sessionId)}/manifest.json`;
}

export function buildChunkKey(sessionId, index) {
  return `${buildSessionPrefix(sessionId)}/chunks/${String(index).padStart(6, '0')}.part`;
}

export function buildStagedObjectKey(sessionId, fileName) {
  return `${buildSessionPrefix(sessionId)}/staged/${sanitizeProFilename(fileName)}`;
}

export function createManifest(input) {
  const totalChunks = safePositiveInt(input.totalChunks, 0);
  const fileSize = safePositiveInt(input.fileSize, 0);
  const chunkBytes = safePositiveInt(input.chunkBytes, CHUNK_BYTES);
  const fileName = sanitizeProFilename(input.fileName || 'upload.bin');
  const now = Date.now();

  return {
    version: 1,
    sessionId: input.sessionId,
    fileName,
    contentType: typeof input.contentType === 'string' ? input.contentType : 'application/octet-stream',
    fileSize,
    totalChunks,
    chunkBytes,
    uploadedCount: 0,
    uploaded: {},
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
  };
}

export function validateSessionInit(input) {
  const totalChunks = safePositiveInt(input.totalChunks, 0);
  const fileSize = safePositiveInt(input.fileSize, 0);
  const chunkBytes = safePositiveInt(input.chunkBytes, CHUNK_BYTES);
  const fileName = typeof input.fileName === 'string' ? input.fileName.trim() : '';

  if (!fileName) return { ok: false, message: 'fileName is required.' };
  if (fileSize <= 0) return { ok: false, message: 'fileSize must be greater than zero.' };
  if (chunkBytes <= 0 || chunkBytes > CHUNK_BYTES) {
    return { ok: false, message: `chunkBytes must be between 1 and ${CHUNK_BYTES}.` };
  }
  if (totalChunks <= 0 || totalChunks > MAX_CHUNKS) {
    return { ok: false, message: `totalChunks must be between 1 and ${MAX_CHUNKS}.` };
  }

  const expected = Math.ceil(fileSize / chunkBytes);
  if (expected !== totalChunks) {
    return { ok: false, message: `totalChunks mismatch. Expected ${expected} for provided fileSize/chunkBytes.` };
  }

  return { ok: true };
}

export function validateChunkIndex(index, totalChunks) {
  const n = safePositiveInt(index, -1);
  if (n < 0 || n >= totalChunks) {
    return { ok: false, message: `index must be between 0 and ${totalChunks - 1}.` };
  }
  return { ok: true, index: n };
}

export function isExpired(manifest) {
  const expiresAt = Date.parse(manifest.expiresAt || '');
  return Number.isFinite(expiresAt) ? Date.now() > expiresAt : true;
}

export async function loadManifest(bucket, sessionId) {
  const object = await bucket.get(buildManifestKey(sessionId));
  if (!object) return null;
  const manifest = await object.json();
  if (!manifest || typeof manifest !== 'object') return null;
  return manifest;
}

export async function saveManifest(bucket, manifest) {
  await bucket.put(buildManifestKey(manifest.sessionId), JSON.stringify(manifest), {
    httpMetadata: { contentType: 'application/json' },
    customMetadata: {
      fileName: manifest.fileName,
      totalChunks: String(manifest.totalChunks),
      uploadedCount: String(manifest.uploadedCount),
    },
  });
}

export async function deleteSessionObjects(bucket, sessionId, totalChunks) {
  const keys = [buildManifestKey(sessionId)];
  for (let i = 0; i < totalChunks; i += 1) {
    keys.push(buildChunkKey(sessionId, i));
  }
  await bucket.delete(keys);
}

export function createChunkConcatStream(bucket, manifest) {
  let currentChunk = 0;
  let activeReader = null;

  return new ReadableStream({
    async pull(controller) {
      while (currentChunk < manifest.totalChunks) {
        if (!activeReader) {
          const key = buildChunkKey(manifest.sessionId, currentChunk);
          const object = await bucket.get(key);
          if (!object?.body) {
            throw new Error(`Missing chunk ${currentChunk}`);
          }
          activeReader = object.body.getReader();
        }

        const step = await activeReader.read();
        if (step.done) {
          activeReader = null;
          currentChunk += 1;
          continue;
        }
        controller.enqueue(step.value);
        return;
      }

      controller.close();
    },
    cancel() {
      if (activeReader) {
        try {
          activeReader.cancel();
        } catch {
          // no-op
        }
      }
    },
  });
}

