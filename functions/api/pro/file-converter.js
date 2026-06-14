import { jsonResponse } from '../../../_lib/json.mjs';
import { requireProUser } from '../../../_lib/proGate.mjs';
import {
  assertProObjectKeyForUser,
  MOCK_CONVERTER_DELAY_MS,
  MOCK_DOCX_BASE64,
  MOCK_PPTX_BASE64,
} from '../../../_lib/proTransientStorage.mjs';

const SUPPORTED_FORMATS = new Set(['docx', 'pptx']);

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
  const format = typeof body.format === 'string' ? body.format.toLowerCase() : 'docx';

  if (!SUPPORTED_FORMATS.has(format)) {
    return jsonResponse(
      { error: 'Bad Request', message: 'Supported formats: docx, pptx.' },
      400,
    );
  }

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
  await new Promise((resolve) => setTimeout(resolve, MOCK_CONVERTER_DELAY_MS));

  try {
    await env.PRO_TRANSIENT.delete(objectKey);
  } catch (err) {
    console.warn('Failed to delete transient object after conversion:', objectKey, err);
  }

  const baseName = fileName.replace(/\.pdf$/i, '') || 'document';
  const outputName = `${baseName}.${format}`;
  const fileBase64 = format === 'pptx' ? MOCK_PPTX_BASE64 : MOCK_DOCX_BASE64;
  const contentType =
    format === 'pptx'
      ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  return jsonResponse({
    success: true,
    format,
    fileName: outputName,
    contentType,
    fileBase64,
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
