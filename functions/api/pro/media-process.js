import { jsonResponse } from '../../_lib/json.mjs';
import { deductOperationCredits, requireProCredits } from '../../_lib/creditEconomy.mjs';
import {
  assertProMediaObjectKeyForUser,
  MEDIA_PRO_ACTIONS,
  MOCK_MEDIA_DELAY_MS,
  sanitizeProFilename,
} from '../../_lib/proTransientStorage.mjs';

function mockOutputFilename(sourceName, action) {
  const base = sanitizeProFilename(sourceName).replace(/\.[^.]+$/i, '') || 'image';
  if (action === 'remove-bg') {
    return `${base}_no_bg.png`;
  }
  if (action === 'restore') {
    return `${base}_restored.jpg`;
  }
  return `${base}_upscaled.png`;
}

function mockOutputContentType(action, sourceContentType) {
  if (action === 'remove-bg') {
    return 'image/png';
  }
  if (action === 'restore') {
    return 'image/jpeg';
  }
  return sourceContentType?.startsWith('image/') ? sourceContentType : 'image/png';
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const gate = await requireProCredits(request, context, 'media-process');
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
  const fileName = typeof body.fileName === 'string' ? body.fileName.slice(0, 200) : 'image.png';
  const action = typeof body.action === 'string' ? body.action : '';

  if (!MEDIA_PRO_ACTIONS.has(action)) {
    return jsonResponse(
      { error: 'Bad Request', message: 'action must be remove-bg, upscale, or restore.' },
      400,
    );
  }

  if (!assertProMediaObjectKeyForUser(objectKey, gate.user.id)) {
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
      { error: 'Not Found', message: 'Uploaded image not found or already expired.' },
      404,
    );
  }

  const started = Date.now();
  await new Promise((resolve) => setTimeout(resolve, MOCK_MEDIA_DELAY_MS));

  const object = await env.PRO_TRANSIENT.get(objectKey);
  if (!object) {
    return jsonResponse(
      { error: 'Not Found', message: 'Uploaded image not found or already expired.' },
      404,
    );
  }

  const imageBytes = await object.arrayBuffer();
  const sourceContentType = object.httpMetadata?.contentType || head.httpMetadata?.contentType;
  const outputContentType = mockOutputContentType(action, sourceContentType);
  const outputFileName = mockOutputFilename(fileName, action);
  const processingMs = Date.now() - started;

  try {
    await env.PRO_TRANSIENT.delete(objectKey);
  } catch (err) {
    console.warn('Failed to delete transient media object after processing:', objectKey, err);
  }

  const remainingCredits = await deductOperationCredits(env, gate.user.id, 'media-process');
  if (remainingCredits === null) {
    return jsonResponse(
      {
        error: 'Payment Required',
        message: 'Credit deduction failed after processing.',
        requiredCredits: gate.cost,
      },
      402,
    );
  }

  return new Response(imageBytes, {
    status: 200,
    headers: {
      'Content-Type': outputContentType,
      'Content-Disposition': `attachment; filename="${outputFileName}"`,
      'Cache-Control': 'no-store',
      'X-GSM-Success': 'true',
      'X-GSM-Mock': 'true',
      'X-GSM-Action': action,
      'X-GSM-File-Name': outputFileName,
      'X-GSM-Processing-Ms': String(processingMs),
      'X-GSM-Credits-Used': String(gate.cost),
      'X-GSM-Remaining-Credits': String(remainingCredits),
    },
  });
}

export async function onRequest(context) {
  if (context.request.method === 'POST') {
    return onRequestPost(context);
  }
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
