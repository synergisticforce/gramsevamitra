import { jsonResponse } from '../../_lib/json.mjs';
import { getRuntimeEnv } from '../../_lib/runtimeEnv.mjs';
import { listMunshiWithdrawals, requestMunshiWithdrawal, settleMunshiWithdrawal } from '../../_lib/auditRepository.mjs';

export async function onRequestGet(context) {
  try {
    const requests = await listMunshiWithdrawals(getRuntimeEnv(context));
    return jsonResponse({ success: true, requests });
  } catch (err) {
    console.error('[audit/munshi-withdraw]', err instanceof Error ? err.message : err);
    return jsonResponse({ success: false, message: 'Withdrawals could not be loaded.' }, 500);
  }
}

export async function onRequestPost(context) {
  let body = {};
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ success: false, message: 'Send the withdrawal as JSON.' }, 400);
  }
  try {
    if (body.action === 'settle') {
      const requestId = typeof body.requestId === 'string' ? body.requestId : '';
      const settled = await settleMunshiWithdrawal(getRuntimeEnv(context), requestId);
      return jsonResponse({ success: true, request: settled });
    }
    const request = await requestMunshiWithdrawal(getRuntimeEnv(context), body);
    return jsonResponse({ success: true, request });
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
    const status = code === 'NOT_FOUND' ? 404 : code === 'INSUFFICIENT_BALANCE' ? 409 : 400;
    return jsonResponse({
      success: false,
      code,
      message: err instanceof Error ? err.message : 'The withdrawal could not be recorded.',
    }, status);
  }
}

export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  if (context.request.method === 'POST') return onRequestPost(context);
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
