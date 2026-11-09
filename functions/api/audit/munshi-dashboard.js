import { jsonResponse } from '../../_lib/json.mjs';
import { getRuntimeEnv } from '../../_lib/runtimeEnv.mjs';
import { munshiDashboard } from '../../_lib/auditRepository.mjs';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const munshiId = url.searchParams.get('munshiId') || '';
  if (!munshiId) return jsonResponse({ success: false, message: 'A munshi id is required.' }, 400);
  try {
    const dashboard = await munshiDashboard(getRuntimeEnv(context), munshiId);
    return jsonResponse({ success: true, ...dashboard });
  } catch (err) {
    console.error('[audit/munshi-dashboard]', err instanceof Error ? err.message : err);
    return jsonResponse({ success: false, message: 'The partner dashboard could not be loaded.' }, 500);
  }
}

export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
