import { jsonResponse } from '../../_lib/json.mjs';
import {
  CHUNK_BYTES,
  createManifest,
  loadManifest,
  saveManifest,
  validateChunkIndex,
  validateSessionInit,
  isExpired,
  buildChunkKey,
  buildSessionId,
  deleteSessionObjects,
} from '../../_lib/chunkedPipeline.mjs';

function ensureBucket(env) {
  return env?.PRO_TRANSIENT || null;
}

export async function onRequestPost(context) {
  const bucket = ensureBucket(context.env);
  if (!bucket) {
    return jsonResponse({ error: 'Service Unavailable', message: 'Transient storage is not configured.' }, 503);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ error: 'Bad Request', message: 'Invalid JSON body.' }, 400);
  }

  const validation = validateSessionInit(body);
  if (!validation.ok) {
    return jsonResponse({ error: 'Bad Request', message: validation.message }, 400);
  }

  const sessionId = buildSessionId();
  const manifest = createManifest({
    sessionId,
    fileName: body.fileName,
    contentType: body.contentType,
    fileSize: body.fileSize,
    totalChunks: body.totalChunks,
    chunkBytes: body.chunkBytes || CHUNK_BYTES,
  });

  await saveManifest(bucket, manifest);

  return jsonResponse({
    success: true,
    sessionId,
    chunkBytes: manifest.chunkBytes,
    totalChunks: manifest.totalChunks,
    expiresAt: manifest.expiresAt,
  });
}

export async function onRequestPut(context) {
  const bucket = ensureBucket(context.env);
  if (!bucket) {
    return jsonResponse({ error: 'Service Unavailable', message: 'Transient storage is not configured.' }, 503);
  }

  const url = new URL(context.request.url);
  const sessionId = url.searchParams.get('sessionId') || '';
  const chunkIndexRaw = url.searchParams.get('index') || '';
  const chunkSizeRaw = Number(url.searchParams.get('chunkSize') || '0');

  if (!sessionId) {
    return jsonResponse({ error: 'Bad Request', message: 'sessionId query param is required.' }, 400);
  }

  const manifest = await loadManifest(bucket, sessionId);
  if (!manifest) {
    return jsonResponse({ error: 'Not Found', message: 'Chunk session not found or expired.' }, 404);
  }

  if (isExpired(manifest)) {
    context.waitUntil?.(deleteSessionObjects(bucket, sessionId, manifest.totalChunks));
    return jsonResponse({ error: 'Gone', message: 'Chunk session expired. Please restart upload.' }, 410);
  }

  const indexValidation = validateChunkIndex(chunkIndexRaw, manifest.totalChunks);
  if (!indexValidation.ok) {
    return jsonResponse({ error: 'Bad Request', message: indexValidation.message }, 400);
  }
  const chunkIndex = indexValidation.index;

  if (!context.request.body) {
    return jsonResponse({ error: 'Bad Request', message: 'Chunk body is required.' }, 400);
  }

  if (chunkSizeRaw <= 0 || chunkSizeRaw > manifest.chunkBytes) {
    return jsonResponse(
      {
        error: 'Bad Request',
        message: `chunkSize must be between 1 and ${manifest.chunkBytes}.`,
      },
      400,
    );
  }

  const key = buildChunkKey(sessionId, chunkIndex);
  await bucket.put(key, context.request.body, {
    httpMetadata: { contentType: 'application/octet-stream' },
    customMetadata: {
      sessionId,
      chunkIndex: String(chunkIndex),
      chunkSize: String(chunkSizeRaw),
    },
  });

  if (!manifest.uploaded[String(chunkIndex)]) {
    manifest.uploaded[String(chunkIndex)] = 1;
    manifest.uploadedCount += 1;
    await saveManifest(bucket, manifest);
  }

  return jsonResponse({
    success: true,
    sessionId,
    index: chunkIndex,
    uploadedCount: manifest.uploadedCount,
    totalChunks: manifest.totalChunks,
    complete: manifest.uploadedCount >= manifest.totalChunks,
  });
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  if (context.request.method === 'PUT') return onRequestPut(context);
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}

