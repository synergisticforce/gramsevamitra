import Stripe from 'stripe';

/** @param {import('@gramsevamitra/auth').AuthEnv & { STRIPE_SECRET_KEY: string }} env */
export function createStripe(env) {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

/**
 * Pro subscription line item — ₹199/month (test mode friendly via price_data).
 * @param {import('@gramsevamitra/auth').AuthEnv & { STRIPE_PRICE_ID?: string }} env
 */
export function buildProLineItems(env) {
  if (env.STRIPE_PRICE_ID) {
    return [{ price: env.STRIPE_PRICE_ID, quantity: 1 }];
  }
  return [
    {
      price_data: {
        currency: 'inr',
        product_data: {
          name: 'GramSeva Mitra Pro',
          description: 'Serverless AI document tools — Smart Extract, high-fidelity DOCX, batch conversion',
        },
        unit_amount: 19900,
        recurring: { interval: 'month' },
      },
      quantity: 1,
    },
  ];
}

/**
 * @param {import('@gramsevamitra/auth').AuthEnv & { STRIPE_SECRET_KEY: string; STRIPE_WEBHOOK_SECRET: string }} env
 * @param {string} rawBody
 * @param {string | null} signature
 */
export function constructStripeEvent(env, rawBody, signature) {
  if (!signature) {
    throw new Error('Missing stripe-signature header');
  }
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }
  const stripe = createStripe(env);
  return stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
}

/**
 * @param {D1Database} db
 * @param {string} userId
 */
export async function setUserPlanPro(db, userId) {
  const now = new Date().toISOString();
  const result = await db
    .prepare(`UPDATE users SET plan = 'pro', updatedAt = ? WHERE id = ?`)
    .bind(now, userId)
    .run();
  return result.success;
}
