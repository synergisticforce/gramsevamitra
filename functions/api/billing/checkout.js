import { jsonResponse } from '../../_lib/json.mjs';
import { getSessionUser } from '../../_lib/session.mjs';
import { buildProLineItems, createStripe } from '../../_lib/stripe.mjs';

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.STRIPE_SECRET_KEY) {
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

  const origin = new URL(request.url).origin;
  const feature = typeof body.feature === 'string' ? body.feature.slice(0, 120) : 'pro_upgrade';

  try {
    const stripe = createStripe(env);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: user.email,
      client_reference_id: user.id,
      metadata: {
        userId: user.id,
        feature,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
        },
      },
      line_items: buildProLineItems(env),
      success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing/cancel`,
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return jsonResponse({ error: 'Could not create checkout session.' }, 500);
    }

    return jsonResponse({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return jsonResponse({ error: 'Unable to start checkout. Please try again.' }, 500);
  }
}
