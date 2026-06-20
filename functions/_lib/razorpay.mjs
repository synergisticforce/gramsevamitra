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
 * Constant-time hex string comparison (mitigates timing attacks on HMAC verify).
 * @param {string} a
 * @param {string} b
 */
function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * @param {string} payload
 * @param {string} secret
 */
async function hmacSha256Hex(payload, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
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

  const expected = await hmacSha256Hex(rawBody, secret);
  return timingSafeEqualHex(expected, signature);
}

/**
 * Verify Razorpay Checkout payment signature (order_id|payment_id HMAC with key secret).
 * @param {string} orderId
 * @param {string} paymentId
 * @param {string | null} signature
 * @param {string} keySecret
 */
export async function verifyRazorpayCheckoutSignature(orderId, paymentId, signature, keySecret) {
  if (!orderId || !paymentId || !signature) {
    return false;
  }
  if (!keySecret) {
    throw new Error('RAZORPAY_KEY_SECRET is not configured');
  }

  const expected = await hmacSha256Hex(`${orderId}|${paymentId}`, keySecret);
  return timingSafeEqualHex(expected, signature);
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

/**
 * @param {import('@gramsevamitra/auth').AuthEnv & {
 *   RAZORPAY_KEY_ID: string;
 *   RAZORPAY_KEY_SECRET: string;
 * }} env
 * @param {Record<string, unknown>} orderEntity
 */
export async function resolveUserIdFromOrder(env, orderEntity) {
  const notes = orderEntity?.notes;
  if (notes && typeof notes === 'object' && typeof notes.userId === 'string' && notes.userId) {
    return notes.userId;
  }

  const orderId = orderEntity?.id;
  if (typeof orderId === 'string' && orderId) {
    const order = await fetchRazorpayOrder(env, orderId);
    const orderNotes = order?.notes;
    if (orderNotes && typeof orderNotes.userId === 'string' && orderNotes.userId) {
      return orderNotes.userId;
    }
  }

  return null;
}
