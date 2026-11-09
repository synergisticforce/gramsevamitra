import { jsonResponse } from '../../_lib/json.mjs';
import { getRuntimeEnv } from '../../_lib/runtimeEnv.mjs';
import { rejectStoredClaim } from '../../_lib/auditRepository.mjs';

export async function onRequestPost(context) {
  let body = {};
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ success: false, message: 'Send the rejection as JSON.' }, 400);
  }
  try {
    const refund = await rejectStoredClaim(getRuntimeEnv(context), body);
    return jsonResponse({ success: true, ...refund });
  } catch (err) {
    const status = err?.code === 'NOT_FOUND' || err?.code === 'REJECTION_TICKET_REQUIRED' ? 400 : 500;
    if (err?.code === 'NOT_FOUND') {
      return jsonResponse({ success: false, message: err.message }, 404);
    }
    return jsonResponse({ success: false, message: err instanceof Error ? err.message : 'The refund could not be recorded.' }, status);
  }
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
