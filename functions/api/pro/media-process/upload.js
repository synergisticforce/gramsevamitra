import { jsonResponse } from '../../_lib/json.mjs';
import { requireProUser } from '../../_lib/proGate.mjs';
import {
  buildProMediaObjectKey,
  PRO_UPLOAD_MAX_BYTES,
} from '../../_lib/proTransientStorage.mjs';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jpg']);

function isImageUpload(file) {
  const type = (file.type || '').toLowerCase();
  if (IMAGE_TYPES.has(type)) return true;
  return /\.(jpe?g|png|webp)$/i.test(file.name || '');
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const gate = await requireProUser(request, env);
  if (!gate.ok) {
    return jsonResponse(gate.body, gate.status);
  }

  if (!env.PRO_TRANSIENT) {
    return jsonResponse(
      { error: 'Service Unavailable', message: 'Transient storage is not configured.' },
      503,
    );
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ error: 'Bad Request', message: 'Expected multipart form data.' }, 400);
  }

  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return jsonResponse({ error: 'Bad Request', message: 'Missing file field.' }, 400);
  }

  if (!isImageUpload(file)) {
    return jsonResponse(
      { error: 'Bad Request', message: 'Only JPG, PNG, and WebP images are supported.' },
      400,
    );
  }

  if (file.size > PRO_UPLOAD_MAX_BYTES) {
    return jsonResponse(
      {
        error: 'Payload Too Large',
        message: `Maximum upload size is ${Math.round(PRO_UPLOAD_MAX_BYTES / (1024 * 1024))} MB.`,
      },
      413,
    );
  }

  const objectKey = buildProMediaObjectKey(gate.user.id, file.name);
  const contentType = file.type || 'application/octet-stream';

  try {
    await env.PRO_TRANSIENT.put(objectKey, file.stream(), {
      httpMetadata: { contentType },
      customMetadata: {
        userId: gate.user.id,
        workspace: 'media',
        originalName: file.name.slice(0, 200),
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Pro media upload failed:', err);
    return jsonResponse({ error: 'Internal Server Error', message: 'Upload to transient storage failed.' }, 500);
  }

  return jsonResponse({
    success: true,
    objectKey,
    fileName: file.name,
    size: file.size,
    contentType,
  });
}

export async function onRequest(context) {
  if (context.request.method === 'POST') {
    return onRequestPost(context);
  }
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
