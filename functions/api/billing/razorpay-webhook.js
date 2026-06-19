import { jsonResponse } from '../../_lib/json.mjs';
import {
  getBillingConfigDiagnostics,
  getBillingEnvFromContext,
  logBillingConfigFailure,
} from '../../_lib/billingEnv.mjs';
import { readEnvString } from '../../_lib/runtimeEnv.mjs';
import { getSessionUser } from '../../_lib/session.mjs';
import {
  activateProFromPayment,
  isOrderProcessed,
} from '../../_lib/userDb.mjs';
import {
  resolveUserIdFromPayment,
  verifyRazorpayWebhookSignature,
} from '../../_lib/razorpay.mjs';

export async function onRequestPost(context) {
  const { request } = context;
  const env = getBillingEnvFromContext(context);
  const billing = getBillingConfigDiagnostics(env);

  const signature = request.headers.get('X-Razorpay-Signature');
  if (!signature) {
    return jsonResponse({ error: 'Webhook signature required' }, 401);
  }

  const webhookSecret = readEnvString(env, 'RAZORPAY_WEBHOOK_SECRET');
  const missing = [...billing.missing];
  if (!webhookSecret) missing.push('RAZORPAY_WEBHOOK_SECRET');

  if (missing.length > 0) {
    logBillingConfigFailure(context, {
      ...billing,
      missing,
      configured: false,
    });
    return jsonResponse({ error: 'Webhook not configured' }, 503);
  }

  const rawBody = await request.text();

  try {
    const valid = await verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret);
    if (!valid) {
      return new Response('Invalid webhook signature', { status: 401 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[billing/razorpay-webhook] Signature verification failed:', message);
    return new Response('Webhook Error', { status: 400 });
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
        console.warn('[billing/razorpay-webhook] payment.captured without payment entity');
        return jsonResponse({ received: true });
      }

      const orderId = paymentEntity.order_id;
      if (typeof orderId !== 'string' || !orderId) {
        return jsonResponse({ received: true });
      }

      if (await isOrderProcessed(env, orderId)) {
        console.log('[billing/razorpay-webhook] Duplicate event ignored for order:', orderId);
        return jsonResponse({ received: true, duplicate: true });
      }

      const userId = await resolveUserIdFromPayment(env, paymentEntity);

      if (userId) {
        const result = await activateProFromPayment(env, {
          userId,
          orderId,
          paymentId: paymentEntity.id ?? null,
        });
        if (!result.ok) {
          console.error('[billing/razorpay-webhook] Pro activation failed for user:', userId);
          return jsonResponse({ error: 'Database update failed' }, 500);
        }
        console.log('[billing/razorpay-webhook] Pro plan activated for user:', userId, 'order:', orderId);
      } else {
        console.warn('[billing/razorpay-webhook] payment.captured without resolvable userId', orderId);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('[billing/razorpay-webhook] Handler error:', { message, stack });
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
