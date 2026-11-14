import { jsonResponse } from '../../_lib/json.mjs';
import { getRuntimeEnv } from '../../_lib/runtimeEnv.mjs';
import { completePro299Checkout, unlockAudit } from '../../_lib/auditRepository.mjs';

export async function onRequestPost(context) {
  let body = {};
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ success: false, message: 'Send the upload id as JSON.' }, 400);
  }
  if (body.mode === 'PRO_299') {
    try {
      const synced = await completePro299Checkout(getRuntimeEnv(context), {
        tenantId: typeof body.tenantId === 'string' ? body.tenantId : '',
        munshiId: typeof body.munshiId === 'string' ? body.munshiId : '',
        amountPaise: 29900,
        orderId: typeof body.orderId === 'string' ? body.orderId : (typeof body.uploadId === 'string' ? body.uploadId : ''),
      });
      return jsonResponse({ success: true, ...synced });
    } catch (err) {
      const status = err?.code === 'TENANT_REQUIRED' || err?.code === 'AMOUNT_MISMATCH' ? 400 : 500;
      return jsonResponse({ success: false, message: err instanceof Error ? err.message : 'Mitra Pro could not be activated.' }, status);
    }
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
