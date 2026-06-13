import { jsonResponse } from '../../_lib/json.mjs';
import { getSessionUser } from '../../_lib/session.mjs';
import {
  PRO_ORDER_AMOUNT_PAISE,
  PRO_ORDER_CURRENCY,
  createProOrder,
} from '../../_lib/razorpay.mjs';

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    return jsonResponse({ error: 'Billing is not configured yet.' }, 503);
  }

  const user = await getSessionUser(request, env);
  if (!user?.id || !user.email) {
    return jsonResponse({ error: 'Sign in with Google to upgrade to Pro.' }, 401);
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

  try {
    const order = await createProOrder(env, {
      userId: user.id,
      email: user.email,
      feature,
    });

    return jsonResponse({
      keyId: env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: order.amount ?? PRO_ORDER_AMOUNT_PAISE,
      currency: order.currency ?? PRO_ORDER_CURRENCY,
      userName: user.name ?? '',
      userEmail: user.email,
    });
  } catch (err) {
    console.error('Razorpay order error:', err);
    return jsonResponse({ error: 'Unable to create payment order. Please try again.' }, 500);
  }
}

export async function onRequest(context) {
  if (context.request.method === 'POST') {
    return onRequestPost(context);
  }
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
