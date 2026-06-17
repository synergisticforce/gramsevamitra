import { jsonResponse } from '../../_lib/json.mjs';
import {
  getBillingConfigDiagnostics,
  getBillingEnvFromContext,
  logBillingConfigFailure,
  withRazorpayEnv,
} from '../../_lib/billingEnv.mjs';
import { getSessionUser } from '../../_lib/session.mjs';
import { PRO_ORDER_AMOUNT_PAISE, PRO_ORDER_CURRENCY } from '../../_lib/proBilling.mjs';
import { createProOrder } from '../../_lib/razorpay.mjs';

export async function onRequestPost(context) {
  const { request } = context;
  const env = getBillingEnvFromContext(context);
  const billing = getBillingConfigDiagnostics(env);

  if (!billing.configured) {
    logBillingConfigFailure(context, billing);
    return jsonResponse(
      {
        error: 'Payment gateway temporarily unavailable. Please try again later.',
        code: 'BILLING_NOT_CONFIGURED',
      },
      503,
    );
  }

  const user = await getSessionUser(request, context);
  if (!user?.id) {
    console.warn('[billing/razorpay-order] Session missing user.id');
    return jsonResponse({ error: 'Sign in with Google to upgrade to Pro.', code: 'AUTH_REQUIRED' }, 401);
  }

  if (!user.email) {
    console.warn('[billing/razorpay-order] Session missing user.email for user', user.id);
    return jsonResponse(
      { error: 'Your account is missing an email address. Re-sign in with Google.', code: 'EMAIL_REQUIRED' },
      401,
    );
  }

  if (user.plan === 'pro') {
    return jsonResponse({ error: 'You already have an active Pro plan.', alreadyPro: true }, 409);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    /* optional JSON body */
  }

  const feature = typeof body.feature === 'string' ? body.feature.slice(0, 120) : 'pro_upgrade';
  const billingEnv = withRazorpayEnv(env);

  try {
    const order = await createProOrder(billingEnv, {
      userId: user.id,
      email: user.email,
      feature,
    });

    const orderAmount = Number(order.amount);
    if (orderAmount !== PRO_ORDER_AMOUNT_PAISE) {
      console.error(
        `[billing/razorpay-order] Amount mismatch: expected ${PRO_ORDER_AMOUNT_PAISE}, got ${orderAmount} (order ${order.id})`,
      );
    }

    return jsonResponse({
      keyId: billing.keyId,
      orderId: order.id,
      amount: PRO_ORDER_AMOUNT_PAISE,
      currency: order.currency ?? PRO_ORDER_CURRENCY,
      userName: user.name ?? '',
      userEmail: user.email,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('[billing/razorpay-order] Razorpay order creation failed', {
      userId: user.id,
      email: user.email,
      feature,
      message,
      stack,
      razorpayStatus: message.includes('Razorpay order failed')
        ? message.match(/\((\d{3})\)/)?.[1] ?? 'unknown'
        : undefined,
    });
    return jsonResponse(
      {
        error: 'Unable to create payment order. Please try again.',
        code: 'RAZORPAY_ORDER_FAILED',
      },
      500,
    );
  }
}

export async function onRequest(context) {
  if (context.request.method === 'POST') {
    return onRequestPost(context);
  }
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
