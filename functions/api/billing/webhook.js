import { jsonResponse } from '../../_lib/json.mjs';
import { constructStripeEvent, setUserPlanPro } from '../../_lib/stripe.mjs';

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.STRIPE_WEBHOOK_SECRET || !env.STRIPE_SECRET_KEY) {
    return jsonResponse({ error: 'Webhook not configured' }, 503);
  }

  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');

  let event;
  try {
    event = constructStripeEvent(env, rawBody, signature);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      /** @type {import('stripe').Stripe.Checkout.Session} */
      const session = event.data.object;
      const userId = session.metadata?.userId || session.client_reference_id;

      if (userId && env.DB) {
        const ok = await setUserPlanPro(env.DB, userId);
        if (!ok) {
          console.error('D1 plan update failed for user:', userId);
          return jsonResponse({ error: 'Database update failed' }, 500);
        }
        console.log('Pro plan activated for user:', userId);
      } else {
        console.warn('checkout.session.completed without userId metadata');
      }
    }
  } catch (err) {
    console.error('Stripe webhook handler error:', err);
    return jsonResponse({ error: 'Webhook handler failed' }, 500);
  }

  return jsonResponse({ received: true });
}
