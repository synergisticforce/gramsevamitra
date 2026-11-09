import { jsonResponse } from '../../_lib/json.mjs';
import { getRuntimeEnv } from '../../_lib/runtimeEnv.mjs';
import { unlockAudit } from '../../_lib/auditRepository.mjs';

export async function onRequestPost(context) {
  let body = {};
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ success: false, message: 'Send the upload id as JSON.' }, 400);
  }
  if (typeof body.uploadId !== 'string' || !body.uploadId) {
    return jsonResponse({ success: false, message: 'An upload id is required.' }, 400);
  }
  try {
    const opened = await unlockAudit(getRuntimeEnv(context), body.uploadId);
    return jsonResponse({ success: true, ...opened });
  } catch (err) {
    const status = err?.code === 'NOT_FOUND' ? 404 : 500;
    return jsonResponse({ success: false, message: err instanceof Error ? err.message : 'The audit could not be unlocked.' }, status);
  }
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
