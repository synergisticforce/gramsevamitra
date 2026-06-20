import { jsonResponse } from '../../_lib/json.mjs';
import { handleRazorpayWebhookPost } from '../../_lib/razorpayWebhook.mjs';

export async function onRequestPost(context) {
  return handleRazorpayWebhookPost(context, 'webhooks/razorpay');
}

export async function onRequest(context) {
  if (context.request.method === 'POST') {
    return onRequestPost(context);
  }
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
