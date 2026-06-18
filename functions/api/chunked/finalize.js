import { jsonResponse } from '../../_lib/json.mjs';
import {
  CHUNK_BYTES,
  buildStagedObjectKey,
  createChunkConcatStream,
  deleteSessionObjects,
  isExpired,
  loadManifest,
} from '../../_lib/chunkedPipeline.mjs';

function ensureBucket(env) {
  return env?.PRO_TRANSIENT || null;
}

function contentDisposition(fileName) {
  const encoded = encodeURIComponent(fileName).replace(/['()]/g, escape).replace(/\*/g, '%2A');
  return `attachment; filename="${fileName}"; filename*=UTF-8''${encoded}`;
}

function validateCompleteManifest(manifest) {
  if (!manifest) return { ok: false, status: 404, message: 'Chunk session not found or expired.' };
  if (isExpired(manifest)) return { ok: false, status: 410, message: 'Chunk session expired. Please restart upload.' };
  if (manifest.uploadedCount !== manifest.totalChunks) {
    return {
      ok: false,
      status: 409,
      message: `Upload incomplete: ${manifest.uploadedCount}/${manifest.totalChunks} chunks present.`,
    };
  }
  return { ok: true };
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

  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
  const mode = body.mode === 'stage' ? 'stage' : 'download';
  if (!sessionId) {
    return jsonResponse({ error: 'Bad Request', message: 'sessionId is required.' }, 400);
  }

  const manifest = await loadManifest(bucket, sessionId);
  const validation = validateCompleteManifest(manifest);
  if (!validation.ok) {
    if (validation.status === 410 && manifest) {
      context.waitUntil?.(deleteSessionObjects(bucket, sessionId, manifest.totalChunks));
    }
    return jsonResponse({ error: 'Bad Request', message: validation.message }, validation.status);
  }

  const stream = createChunkConcatStream(bucket, manifest);

  if (mode === 'stage') {
    const objectKey = buildStagedObjectKey(sessionId, manifest.fileName);
    await bucket.put(objectKey, stream, {
      httpMetadata: { contentType: manifest.contentType || 'application/octet-stream' },
      customMetadata: {
        source: 'chunked-finalize',
        sessionId,
        totalChunks: String(manifest.totalChunks),
        chunkBytes: String(manifest.chunkBytes || CHUNK_BYTES),
      },
    });

    context.waitUntil?.(deleteSessionObjects(bucket, sessionId, manifest.totalChunks));

    return jsonResponse({
      success: true,
      mode: 'stage',
      objectKey,
      fileName: manifest.fileName,
      contentType: manifest.contentType,
      fileSize: manifest.fileSize,
    });
  }

  const cleanup = deleteSessionObjects(bucket, sessionId, manifest.totalChunks).catch((err) => {
    console.warn('Chunk cleanup failed', { sessionId, err });
  });
  context.waitUntil?.(cleanup);

  /** @type {Record<string, string>} */
  const headers = {
    'Content-Type': manifest.contentType || 'application/octet-stream',
    'Content-Disposition': contentDisposition(manifest.fileName),
    'Cache-Control': 'no-store',
    'X-GSM-File-Name': manifest.fileName,
    'X-GSM-Chunked-Session': sessionId,
    'X-GSM-Chunked-Chunks': String(manifest.totalChunks),
  };
  if (manifest.fileSize > 0) {
    headers['Content-Length'] = String(manifest.fileSize);
  }

  return new Response(stream, {
    status: 200,
    headers,
  });
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}

