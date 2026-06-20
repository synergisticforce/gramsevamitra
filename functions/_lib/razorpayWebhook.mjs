import { jsonResponse } from './json.mjs';
import {
  getBillingConfigDiagnostics,
  getBillingEnvFromContext,
  logBillingConfigFailure,
  withRazorpayEnv,
} from './billingEnv.mjs';
import { readEnvString } from './runtimeEnv.mjs';
import { activateProFromPayment, isOrderProcessed } from './userDb.mjs';
import {
  resolveUserIdFromOrder,
  resolveUserIdFromPayment,
  verifyRazorpayWebhookSignature,
} from './razorpay.mjs';

/**
 * @param {Record<string, unknown>} env
 * @param {{ orderId: string; paymentId?: string | null; userId: string; logTag: string }} input
 */
async function activateProForOrder(env, input) {
  const { orderId, paymentId, userId, logTag } = input;

  if (await isOrderProcessed(env, orderId)) {
    console.log(`[${logTag}] Duplicate event ignored for order:`, orderId);
    return { duplicate: true, activated: false };
  }

  const result = await activateProFromPayment(env, {
    userId,
    orderId,
    paymentId: paymentId ?? null,
  });

  if (!result.ok) {
    console.error(`[${logTag}] Pro activation failed for user:`, userId);
    return { duplicate: false, activated: false, failed: true };
  }

  console.log(`[${logTag}] Pro plan activated for user:`, userId, 'order:', orderId);
  return { duplicate: Boolean(result.duplicate), activated: true };
}

/**
 * @param {Record<string, unknown>} env
 * @param {Record<string, unknown>} paymentEntity
 * @param {string} logTag
 */
async function handlePaymentCaptured(env, paymentEntity, logTag) {
  const orderId = paymentEntity.order_id;
  if (typeof orderId !== 'string' || !orderId) {
    return jsonResponse({ received: true });
  }

  const billingEnv = withRazorpayEnv(env);
  const userId = await resolveUserIdFromPayment(billingEnv, paymentEntity);
  if (!userId) {
    console.warn(`[${logTag}] payment.captured without resolvable userId`, orderId);
    return jsonResponse({ received: true });
  }

  const outcome = await activateProForOrder(env, {
    orderId,
    paymentId: typeof paymentEntity.id === 'string' ? paymentEntity.id : null,
    userId,
    logTag,
  });

  if (outcome.failed) {
    return jsonResponse({ error: 'Database update failed' }, 500);
  }

  return jsonResponse({ received: true, duplicate: outcome.duplicate || undefined });
}

/**
 * @param {Record<string, unknown>} env
 * @param {Record<string, unknown>} orderEntity
 * @param {Record<string, unknown> | undefined} paymentEntity
 * @param {string} logTag
 */
async function handleOrderPaid(env, orderEntity, paymentEntity, logTag) {
  const orderId = orderEntity.id;
  if (typeof orderId !== 'string' || !orderId) {
    return jsonResponse({ received: true });
  }

  if (orderEntity.status !== 'paid') {
    console.warn(`[${logTag}] order.paid with non-paid status:`, orderEntity.status, orderId);
    return jsonResponse({ received: true });
  }

  const billingEnv = withRazorpayEnv(env);
  const userId = await resolveUserIdFromOrder(billingEnv, orderEntity);
  if (!userId) {
    console.warn(`[${logTag}] order.paid without resolvable userId`, orderId);
    return jsonResponse({ received: true });
  }

  const outcome = await activateProForOrder(env, {
    orderId,
    paymentId: typeof paymentEntity?.id === 'string' ? paymentEntity.id : null,
    userId,
    logTag,
  });

  if (outcome.failed) {
    return jsonResponse({ error: 'Database update failed' }, 500);
  }

  return jsonResponse({ received: true, duplicate: outcome.duplicate || undefined });
}

/**
 * Secure Razorpay webhook handler — verifies X-Razorpay-Signature and activates Pro.
 * @param {Record<string, unknown>} context
 * @param {string} [logTag='webhooks/razorpay']
 */
export async function handleRazorpayWebhookPost(context, logTag = 'webhooks/razorpay') {
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
    console.error(`[${logTag}] Signature verification failed:`, message);
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
        console.warn(`[${logTag}] payment.captured without payment entity`);
        return jsonResponse({ received: true });
      }
      return handlePaymentCaptured(env, paymentEntity, logTag);
    }

    if (event.event === 'order.paid') {
      const orderEntity = event.payload?.order?.entity;
      if (!orderEntity) {
        console.warn(`[${logTag}] order.paid without order entity`);
        return jsonResponse({ received: true });
      }
      const paymentEntity = event.payload?.payment?.entity;
      return handleOrderPaid(env, orderEntity, paymentEntity, logTag);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(`[${logTag}] Handler error:`, { message, stack });
    return jsonResponse({ error: 'Webhook handler failed' }, 500);
  }

  return jsonResponse({ received: true });
}
