import { jsonResponse } from '../../../_lib/json.mjs';
import { requireProUser } from '../../../_lib/proGate.mjs';
import {
  assertProObjectKeyForUser,
  MOCK_EXTRACT_CSV,
  MOCK_EXTRACT_DELAY_MS,
} from '../../../_lib/proTransientStorage.mjs';

export async function onRequestPost(context) {
  const { request, env } = context;

  const gate = await requireProUser(request, env);
  if (!gate.ok) {
    return jsonResponse(gate.body, gate.status);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Bad Request', message: 'Invalid JSON body.' }, 400);
  }

  const objectKey = typeof body.objectKey === 'string' ? body.objectKey : '';
  const fileName =
    typeof body.fileName === 'string' ? body.fileName.slice(0, 200) : 'document.pdf';

  if (!assertProObjectKeyForUser(objectKey, gate.user.id)) {
    return jsonResponse(
      { error: 'Forbidden', message: 'Invalid or unauthorized object reference.' },
      403,
    );
  }

  if (!env.PRO_TRANSIENT) {
    return jsonResponse(
      { error: 'Service Unavailable', message: 'Transient storage is not configured.' },
      503,
    );
  }

  const head = await env.PRO_TRANSIENT.head(objectKey);
  if (!head) {
    return jsonResponse(
      { error: 'Not Found', message: 'Uploaded document not found or already expired.' },
      404,
    );
  }

  const started = Date.now();
  await new Promise((resolve) => setTimeout(resolve, MOCK_EXTRACT_DELAY_MS));

  try {
    await env.PRO_TRANSIENT.delete(objectKey);
  } catch (err) {
    console.warn('Failed to delete transient object after extract:', objectKey, err);
  }

  return jsonResponse({
    success: true,
    format: 'csv',
    csv: MOCK_EXTRACT_CSV,
    fileName: 'extracted_data.csv',
    sourceFile: fileName,
    objectKey,
    processingMs: Date.now() - started,
    mock: true,
  });
}

export async function onRequest(context) {
  if (context.request.method === 'POST') {
    return onRequestPost(context);
  }
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
