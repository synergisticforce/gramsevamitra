import { jsonResponse } from '../../_lib/json.mjs';
import {
  getBillingConfigDiagnostics,
  getBillingEnvFromContext,
  logBillingConfigFailure,
  withRazorpayEnv,
} from '../../_lib/billingEnv.mjs';
import { PRO_ORDER_AMOUNT_PAISE } from '../../_lib/proBilling.mjs';
import { getSessionUser } from '../../_lib/session.mjs';
import { activateProFromPayment, getUserRow } from '../../_lib/userDb.mjs';
import {
  fetchRazorpayOrder,
  verifyRazorpayCheckoutSignature,
} from '../../_lib/razorpay.mjs';

export async function onRequestPost(context) {
  const { request } = context;
  const env = getBillingEnvFromContext(context);
  const billing = getBillingConfigDiagnostics(env);

  if (!billing.configured) {
    logBillingConfigFailure(context, billing);
    return jsonResponse({ error: 'Payment gateway unavailable.', code: 'BILLING_NOT_CONFIGURED' }, 503);
  }

  const user = await getSessionUser(request, context);
  if (!user?.id) {
    return jsonResponse({ error: 'Sign in required.', code: 'AUTH_REQUIRED' }, 401);
  }

  if (user.plan === 'pro') {
    return jsonResponse({ proActive: true, plan: 'pro', alreadyPro: true });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const orderId = typeof body.orderId === 'string' ? body.orderId : body.razorpay_order_id;
  const paymentId = typeof body.paymentId === 'string' ? body.paymentId : body.razorpay_payment_id;
  const signature = typeof body.signature === 'string' ? body.signature : body.razorpay_signature;

  if (!orderId || !paymentId || !signature) {
    return jsonResponse({ error: 'Missing payment verification fields.', code: 'INVALID_PAYLOAD' }, 400);
  }

  const billingEnv = withRazorpayEnv(env);

  try {
    const valid = await verifyRazorpayCheckoutSignature(
      orderId,
      paymentId,
      signature,
      billingEnv.RAZORPAY_KEY_SECRET,
    );
    if (!valid) {
      console.warn('[billing/verify-payment] Invalid checkout signature for order:', orderId);
      return jsonResponse({ error: 'Payment verification failed.', code: 'INVALID_SIGNATURE' }, 401);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[billing/verify-payment] Signature check error:', message);
    return jsonResponse({ error: 'Payment verification failed.' }, 400);
  }

  try {
    const order = await fetchRazorpayOrder(billingEnv, orderId);
    const orderUserId = order?.notes?.userId;
    if (orderUserId !== user.id) {
      console.warn('[billing/verify-payment] Order user mismatch:', { orderId, sessionUser: user.id });
      return jsonResponse({ error: 'Order does not belong to this account.', code: 'ORDER_MISMATCH' }, 403);
    }

    const orderAmount = Number(order.amount);
    if (orderAmount !== PRO_ORDER_AMOUNT_PAISE) {
      console.error('[billing/verify-payment] Amount mismatch:', { orderId, orderAmount });
      return jsonResponse({ error: 'Invalid order amount.', code: 'AMOUNT_MISMATCH' }, 400);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[billing/verify-payment] Order fetch failed:', message);
    return jsonResponse({ error: 'Unable to verify order.' }, 502);
  }

  const result = await activateProFromPayment(env, {
    userId: user.id,
    orderId,
    paymentId,
  });

  if (!result.ok) {
    return jsonResponse({ error: 'Pro activation failed.' }, 500);
  }

  const row = await getUserRow(env, user.id);
  return jsonResponse({
    proActive: row?.plan === 'pro',
    plan: row?.plan ?? 'pro',
    duplicate: Boolean(result.duplicate),
  });
}

export async function onRequest(context) {
  if (context.request.method === 'POST') {
    return onRequestPost(context);
  }
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
