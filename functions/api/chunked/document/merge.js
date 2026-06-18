import { jsonResponse } from '../../../_lib/json.mjs';
import { getSafeStagedKeys, mergeChunkedPdfs } from '../../../_lib/chunkedDocumentProcessing.mjs';

export async function onRequestPost(context) {
  const bucket = context.env?.PRO_TRANSIENT;
  if (!bucket) {
    return jsonResponse({ error: 'Service Unavailable', message: 'Transient storage is not configured.' }, 503);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ error: 'Bad Request', message: 'Invalid JSON body.' }, 400);
  }

  const objectKeys = getSafeStagedKeys(body.objectKeys);
  const fileName = typeof body.fileName === 'string' ? body.fileName : 'merged.pdf';
  if (objectKeys.length < 2) {
    return jsonResponse(
      { error: 'Bad Request', message: 'At least two valid staged object keys are required.' },
      400,
    );
  }

  try {
    const response = await mergeChunkedPdfs({ bucket, objectKeys, fileName });
    context.waitUntil?.(bucket.delete(objectKeys));
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Merge failed.';
    return jsonResponse({ error: 'Bad Request', message }, 400);
  }
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}

