import { jsonResponse } from '../../_lib/json.mjs';
import {
  getBillingConfigDiagnostics,
  getBillingEnvFromContext,
  logBillingConfigFailure,
  withRazorpayEnv,
} from '../../_lib/billingEnv.mjs';
import { readEnvString } from '../../_lib/runtimeEnv.mjs';
import { getSessionUser } from '../../_lib/session.mjs';
import {
  fetchRazorpayOrder,
  resolveUserIdFromPayment,
  setUserPlanPro,
  verifyRazorpayCheckoutSignature,
  verifyRazorpayWebhookSignature,
} from '../../_lib/razorpay.mjs';

/**
 * Client-side Checkout handler verification (session + HMAC on order_id|payment_id).
 */
async function handleClientPaymentVerification(context, rawBody, env) {
  const { request } = context;

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload' }, 400);
  }

  const paymentId = body.razorpay_payment_id;
  const orderId = body.razorpay_order_id;
  const paymentSignature = body.razorpay_signature;

  if (
    typeof paymentId !== 'string' ||
    typeof orderId !== 'string' ||
    typeof paymentSignature !== 'string' ||
    !paymentId ||
    !orderId ||
    !paymentSignature
  ) {
    return jsonResponse({ error: 'Missing payment verification fields' }, 400);
  }

  const billing = getBillingConfigDiagnostics(env);
  if (!billing.configured) {
    logBillingConfigFailure(context, billing);
    return jsonResponse({ error: 'Payment gateway temporarily unavailable.' }, 503);
  }

  const user = await getSessionUser(request, context);
  if (!user?.id) {
    return jsonResponse({ error: 'Sign in with Google to complete Pro upgrade.', code: 'AUTH_REQUIRED' }, 401);
  }

  if (user.plan === 'pro') {
    return jsonResponse({ success: true, plan: 'pro' });
  }

  const billingEnv = withRazorpayEnv(env);
  const keySecret = readEnvString(billingEnv, 'RAZORPAY_KEY_SECRET');
  if (!keySecret) {
    return jsonResponse({ error: 'Payment gateway temporarily unavailable.' }, 503);
  }

  try {
    const valid = await verifyRazorpayCheckoutSignature(orderId, paymentId, paymentSignature, keySecret);
    if (!valid) {
      console.warn('[billing/razorpay-webhook] Client payment signature invalid for user', user.id);
      return jsonResponse({ error: 'Invalid payment signature' }, 400);
    }

    const order = await fetchRazorpayOrder(billingEnv, orderId);
    const orderUserId = order?.notes?.userId;
    if (typeof orderUserId !== 'string' || orderUserId !== user.id) {
      console.warn('[billing/razorpay-webhook] Order user mismatch', { orderUserId, userId: user.id, orderId });
      return jsonResponse({ error: 'Order does not belong to this account' }, 403);
    }

    if (!env.DB) {
      return jsonResponse({ error: 'Database unavailable' }, 503);
    }

    const ok = await setUserPlanPro(env.DB, user.id);
    if (!ok) {
      console.error('[billing/razorpay-webhook] Client verify D1 plan update failed for user:', user.id);
      return jsonResponse({ error: 'Database update failed' }, 500);
    }

    console.log('[billing/razorpay-webhook] Pro plan activated via client verify for user:', user.id, 'payment:', paymentId);
    return jsonResponse({ success: true, plan: 'pro' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[billing/razorpay-webhook] Client verify error:', message);
    return jsonResponse({ error: 'Payment verification failed' }, 500);
  }
}

export async function onRequestPost(context) {
  const { request } = context;
  const env = getBillingEnvFromContext(context);
  const rawBody = await request.text();
  const signature = request.headers.get('X-Razorpay-Signature');

  if (!signature) {
    return handleClientPaymentVerification(context, rawBody, env);
  }

  const billing = getBillingConfigDiagnostics(env);

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

      const userId = await resolveUserIdFromPayment(env, paymentEntity);

      if (userId && env.DB) {
        const ok = await setUserPlanPro(env.DB, userId);
        if (!ok) {
          console.error('[billing/razorpay-webhook] D1 plan update failed for user:', userId);
          return jsonResponse({ error: 'Database update failed' }, 500);
        }
        console.log('[billing/razorpay-webhook] Pro plan activated for user:', userId, 'payment:', paymentEntity.id);
      } else {
        console.warn('[billing/razorpay-webhook] payment.captured without resolvable userId', paymentEntity.order_id);
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
