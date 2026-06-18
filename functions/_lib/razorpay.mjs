import {
  PRO_ORDER_AMOUNT_PAISE,
  PRO_ORDER_CURRENCY,
} from './proBilling.mjs';
import { withRazorpayEnv } from './billingEnv.mjs';

export { PRO_ORDER_AMOUNT_PAISE, PRO_ORDER_CURRENCY };

/**
 * @param {import('@gramsevamitra/auth').AuthEnv & Record<string, string | undefined>} env
 */
function assertRazorpayKeys(env) {
  const billingEnv = withRazorpayEnv(env);
  if (!billingEnv.RAZORPAY_KEY_ID || !billingEnv.RAZORPAY_KEY_SECRET) {
    throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are not configured');
  }
  return billingEnv;
}

/**
 * @param {import('@gramsevamitra/auth').AuthEnv & {
 *   RAZORPAY_KEY_ID: string;
 *   RAZORPAY_KEY_SECRET: string;
 * }} env
 */
function razorpayAuthHeader(env) {
  const billingEnv = assertRazorpayKeys(env);
  return `Basic ${btoa(`${billingEnv.RAZORPAY_KEY_ID}:${billingEnv.RAZORPAY_KEY_SECRET}`)}`;
}

/**
 * @param {import('@gramsevamitra/auth').AuthEnv & {
 *   RAZORPAY_KEY_ID: string;
 *   RAZORPAY_KEY_SECRET: string;
 * }} env
 * @param {{ userId: string; email?: string; feature?: string }} input
 */
export async function createProOrder(env, input) {
  const receipt = `pro${Date.now()}`.slice(0, 40);

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: razorpayAuthHeader(env),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: PRO_ORDER_AMOUNT_PAISE,
      currency: PRO_ORDER_CURRENCY,
      receipt,
      notes: {
        userId: input.userId,
        email: input.email ?? '',
        feature: input.feature ?? 'pro_upgrade',
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Razorpay order failed (${response.status}): ${detail}`);
  }

  return response.json();
}

/**
 * Verify Razorpay webhook HMAC-SHA256 (edge-compatible Web Crypto).
 * @param {string} rawBody
 * @param {string | null} signature
 * @param {string} secret
 */
export async function verifyRazorpayWebhookSignature(rawBody, signature, secret) {
  if (!signature) {
    throw new Error('Missing X-Razorpay-Signature header');
  }
  if (!secret) {
    throw new Error('RAZORPAY_WEBHOOK_SECRET is not configured');
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const expected = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  return expected === signature;
}

/**
 * Verify Razorpay Checkout `handler` callback signature (order_id|payment_id).
 * @param {string} orderId
 * @param {string} paymentId
 * @param {string | null | undefined} signature
 * @param {string} secret
 */
export async function verifyRazorpayCheckoutSignature(orderId, paymentId, signature, secret) {
  if (!signature) {
    throw new Error('Missing razorpay_signature');
  }
  if (!secret) {
    throw new Error('RAZORPAY_KEY_SECRET is not configured');
  }

  const payload = `${orderId}|${paymentId}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const expected = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  return expected === signature;
}

/**
 * @param {import('@gramsevamitra/auth').AuthEnv & {
 *   RAZORPAY_KEY_ID: string;
 *   RAZORPAY_KEY_SECRET: string;
 * }} env
 * @param {string} orderId
 */
export async function fetchRazorpayOrder(env, orderId) {
  const response = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, {
    headers: {
      Authorization: razorpayAuthHeader(env),
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Razorpay order fetch failed (${response.status}): ${detail}`);
  }

  return response.json();
}

import { PRO_MONTHLY_CREDIT_FUP } from '../../packages/shared/src/lib/aiCredits.mjs';

/**
 * @param {D1Database} db
 * @param {string} userId
 */
export async function setUserPlanPro(db, userId) {
  const now = new Date().toISOString();
  const result = await db
    .prepare(`UPDATE users SET plan = 'pro', credits = ?, updatedAt = ? WHERE id = ?`)
    .bind(PRO_MONTHLY_CREDIT_FUP, now, userId)
    .run();
  return result.success;
}

/**
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
