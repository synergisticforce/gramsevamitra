import Razorpay from 'razorpay';

/** Pro plan — ₹199/month (charged as a Razorpay Order in INR paise). */
export const PRO_ORDER_AMOUNT_PAISE = 19900;
export const PRO_ORDER_CURRENCY = 'INR';

/**
 * @param {import('@gramsevamitra/auth').AuthEnv & {
 *   RAZORPAY_KEY_ID: string;
 *   RAZORPAY_KEY_SECRET: string;
 * }} env
 */
export function createRazorpayClient(env) {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are not configured');
  }
  return new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
  });
}

/**
 * @param {import('@gramsevamitra/auth').AuthEnv & {
 *   RAZORPAY_KEY_ID: string;
 *   RAZORPAY_KEY_SECRET: string;
 * }} env
 * @param {{ userId: string; email?: string; feature?: string }} input
 */
export async function createProOrder(env, input) {
  const client = createRazorpayClient(env);
  const receipt = `pro${Date.now()}`.slice(0, 40);

  return client.orders.create({
    amount: PRO_ORDER_AMOUNT_PAISE,
    currency: PRO_ORDER_CURRENCY,
    receipt,
    notes: {
      userId: input.userId,
      email: input.email ?? '',
      feature: input.feature ?? 'pro_upgrade',
    },
  });
}

/**
 * Verify Razorpay webhook HMAC (uses official SDK helper).
 * @param {string} rawBody
 * @param {string | null} signature
 * @param {string} secret
 */
export function verifyRazorpayWebhookSignature(rawBody, signature, secret) {
  if (!signature) {
    throw new Error('Missing X-Razorpay-Signature header');
  }
  if (!secret) {
    throw new Error('RAZORPAY_WEBHOOK_SECRET is not configured');
  }
  return Razorpay.validateWebhookSignature(rawBody, signature, secret);
}

/**
 * @param {import('@gramsevamitra/auth').AuthEnv & {
 *   RAZORPAY_KEY_ID: string;
 *   RAZORPAY_KEY_SECRET: string;
 * }} env
 * @param {string} orderId
 */
export async function fetchRazorpayOrder(env, orderId) {
  const client = createRazorpayClient(env);
  return client.orders.fetch(orderId);
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

/**
 * Resolve Better Auth user id from a payment.captured webhook payload.
 * @param {import('@gramsevamitra/auth').AuthEnv & {
 *   RAZORPAY_KEY_ID: string;
 *   RAZORPAY_KEY_SECRET: string;
 * }} env
 * @param {Record<string, unknown>} paymentEntity
 */
export async function resolveUserIdFromPayment(env, paymentEntity) {
  const notes = paymentEntity?.notes;
  if (notes && typeof notes === 'object' && typeof notes.userId === 'string' && notes.userId) {
    return notes.userId;
  }

  const orderId = paymentEntity?.order_id;
  if (typeof orderId === 'string' && orderId) {
    const order = await fetchRazorpayOrder(env, orderId);
    const orderNotes = order?.notes;
    if (orderNotes && typeof orderNotes.userId === 'string' && orderNotes.userId) {
      return orderNotes.userId;
    }
  }

  return null;
}
