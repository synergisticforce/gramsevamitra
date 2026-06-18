import { jsonResponse } from '../../../_lib/json.mjs';
import { processChunkedDocument } from '../../../_lib/chunkedDocumentProcessing.mjs';

export async function onRequestPost(context) {
  const bucket = context.env?.PRO_TRANSIENT;
  if (!bucket) {
    return jsonResponse(
      { error: 'Service Unavailable', message: 'Transient storage is not configured.' },
      503,
    );
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ error: 'Bad Request', message: 'Invalid JSON body.' }, 400);
  }

  const operation = typeof body.operation === 'string' ? body.operation : '';
  const objectKey = typeof body.objectKey === 'string' ? body.objectKey : '';
  const fileName = typeof body.fileName === 'string' ? body.fileName : 'document.pdf';
  const params = body.params && typeof body.params === 'object' ? body.params : {};

  if (!operation || !objectKey) {
    return jsonResponse(
      { error: 'Bad Request', message: 'operation and objectKey are required.' },
      400,
    );
  }

  try {
    const response = await processChunkedDocument({
      bucket,
      operation,
      objectKey,
      fileName,
      params,
    });
    context.waitUntil?.(bucket.delete([objectKey]));
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Processing failed.';
    return jsonResponse({ error: 'Bad Request', message }, 400);
  }
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
