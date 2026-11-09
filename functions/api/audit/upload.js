import { jsonResponse } from '../../_lib/json.mjs';
import { getRuntimeEnv } from '../../_lib/runtimeEnv.mjs';
import { createAuditUpload } from '../../_lib/auditRepository.mjs';

export async function onRequestPost(context) {
  let body = {};
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ success: false, message: 'Send the statement as JSON.' }, 400);
  }
  try {
    const saved = await createAuditUpload(getRuntimeEnv(context), body);
    return jsonResponse({ success: true, ...saved });
  } catch (err) {
    const status = err?.code === 'STATEMENT_REQUIRED' ? 400 : 500;
    console.error('[audit/upload]', err instanceof Error ? err.message : err);
    return jsonResponse({ success: false, message: err instanceof Error ? err.message : 'The audit could not be saved.' }, status);
  }
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
