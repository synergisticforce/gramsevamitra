import { jsonResponse } from '../../_lib/json.mjs';
import { getRuntimeEnv } from '../../_lib/runtimeEnv.mjs';
import { resolveStoredCell } from '../../_lib/auditRepository.mjs';

export async function onRequestPost(context) {
  let body = {};
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ success: false, message: 'Send the cell correction as JSON.' }, 400);
  }
  try {
    const healed = await resolveStoredCell(getRuntimeEnv(context), body);
    return jsonResponse({ success: true, ...healed });
  } catch (err) {
    const status = err?.code === 'NOT_FOUND' ? 404 : 500;
    return jsonResponse({ success: false, message: err instanceof Error ? err.message : 'That cell could not be updated.' }, status);
  }
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
