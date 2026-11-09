import { jsonResponse } from '../_lib/json.mjs';
import { getRuntimeEnv } from '../_lib/runtimeEnv.mjs';

/**
 * @param {Record<string, unknown>} env
 */
export function buildHealthReport(env) {
  const key = typeof env?.RAZORPAY_KEY_ID === 'string' ? env.RAZORPAY_KEY_ID : '';
  let razorpayMode = 'UNCONFIGURED';
  if (key.startsWith('rzp_live_')) razorpayMode = 'LIVE';
  else if (key.startsWith('rzp_test_')) razorpayMode = 'TEST';
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0-cloudflare-native',
    databaseConfigured: Boolean(env?.DATABASE_URL),
    razorpayMode,
    aiProvidersConfigured: {
      gemini: Boolean(env?.GEMINI_API_KEY),
      sarvam: Boolean(env?.SARVAM_API_KEY),
      azureDocIntel: Boolean(env?.AZURE_DOC_INTEL_KEY),
    },
  };
}

export async function onRequestGet(context) {
  return jsonResponse(buildHealthReport(getRuntimeEnv(context)));
}

export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
