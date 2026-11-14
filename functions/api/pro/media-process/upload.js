import { jsonResponse } from '../../../_lib/json.mjs';

/** Companion upload for the hard-blocked media-process mock. */
export async function onRequestPost() {
  return jsonResponse(
    {
      success: false,
      error: 'Service Unavailable',
      code: 'FEATURE_NOT_AVAILABLE',
      creditsCharged: 0,
      message: 'This feature is not available.',
    },
    503,
  );
}

export async function onRequest(context) {
  if (context.request.method === 'POST') {
    return onRequestPost();
  }
  return jsonResponse({ error: 'Method Not Allowed', creditsCharged: 0 }, 405);
}
