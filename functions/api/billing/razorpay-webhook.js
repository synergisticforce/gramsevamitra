import { jsonResponse } from '../../_lib/json.mjs';
import {
  resolveUserIdFromPayment,
  setUserPlanPro,
  verifyRazorpayWebhookSignature,
} from '../../_lib/razorpay.mjs';

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.RAZORPAY_WEBHOOK_SECRET || !env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    return jsonResponse({ error: 'Webhook not configured' }, 503);
  }

  const rawBody = await request.text();
  const signature = request.headers.get('X-Razorpay-Signature');

  try {
    const valid = await verifyRazorpayWebhookSignature(rawBody, signature, env.RAZORPAY_WEBHOOK_SECRET);
    if (!valid) {
      return new Response('Invalid webhook signature', { status: 401 });
    }
  } catch (err) {
    console.error('Razorpay webhook signature verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload' }, 400);
  }

  try {
    if (event.event === 'payment.captured') {
      const paymentEntity = event.payload?.payment?.entity;
      if (!paymentEntity) {
        console.warn('payment.captured without payment entity');
        return jsonResponse({ received: true });
      }

      const userId = await resolveUserIdFromPayment(env, paymentEntity);

      if (userId && env.DB) {
        const ok = await setUserPlanPro(env.DB, userId);
        if (!ok) {
          console.error('D1 plan update failed for user:', userId);
          return jsonResponse({ error: 'Database update failed' }, 500);
        }
        console.log('Pro plan activated for user:', userId, 'payment:', paymentEntity.id);
      } else {
        console.warn('payment.captured without resolvable userId', paymentEntity.order_id);
      }
    }
  } catch (err) {
    console.error('Razorpay webhook handler error:', err);
    return jsonResponse({ error: 'Webhook handler failed' }, 500);
  }

  return jsonResponse({ received: true });
}

export async function onRequest(context) {
  if (context.request.method === 'POST') {
    return onRequestPost(context);
  }
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
