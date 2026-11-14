import { jsonResponse } from '../../_lib/json.mjs';
import { getRuntimeEnv } from '../../_lib/runtimeEnv.mjs';
import { processTrustClock } from '../../_lib/auditRepository.mjs';

export async function onRequestPost(context) {
  let body = {};
  try {
    body = await context.request.json();
  } catch {
    body = {};
  }
  try {
    const result = await processTrustClock(getRuntimeEnv(context), {
      now: body.now,
      testMode: body.testMode === true,
    });
    return jsonResponse({ success: true, ...result });
  } catch (err) {
    console.error('[audit/process-trust-clock]', err instanceof Error ? err.message : err);
    return jsonResponse({ success: false, message: 'The trust clock could not be checked.' }, 500);
  }
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
