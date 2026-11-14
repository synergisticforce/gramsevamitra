import { jsonResponse } from '../../_lib/json.mjs';
import { getRuntimeEnv, readEnvFromContext } from '../../_lib/runtimeEnv.mjs';
import { createUnlockCheckout } from '../../_lib/auditRepository.mjs';

const MODES = new Set(['TRUST_CLOCK_MANDATE', 'ONE_TAP_UPI', 'PRO_299']);

async function razorpayOrder(context, amountPaise, receipt, notes) {
  const keyId = readEnvFromContext(context, 'RAZORPAY_KEY_ID');
  const secret = readEnvFromContext(context, 'RAZORPAY_KEY_SECRET');
  if (!keyId || !secret) return { configured: false, order: null, keyId: '' };
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${keyId}:${secret}`)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt, notes }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Razorpay order failed (${response.status}): ${detail}`);
  }
  return { configured: true, keyId, order: await response.json() };
}

export async function onRequestPost(context) {
  let body = {};
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ success: false, message: 'Send the checkout request as JSON.' }, 400);
  }
  const uploadId = typeof body.uploadId === 'string' ? body.uploadId : '';
  const mode = MODES.has(body.mode) ? body.mode : 'ONE_TAP_UPI';
  if (!uploadId) return jsonResponse({ success: false, message: 'An upload id is required.' }, 400);
  try {
    const prepared = await createUnlockCheckout(getRuntimeEnv(context), uploadId, mode);
    const amountPaise = prepared.checkout.amountPaise;
    let razorpay = { configured: false, order: null, keyId: '' };
    try {
      razorpay = await razorpayOrder(context, amountPaise, `audit${Date.now()}`.slice(0, 40), {
        uploadId,
        mode,
        tenantId: String(prepared.tenantId || ''),
        munshiId: String(prepared.munshiId || ''),
        maxAmountPaise: String(prepared.checkout.maxAmountPaise || amountPaise),
      });
    } catch (err) {
      console.error('[audit/create-unlock-checkout]', err instanceof Error ? err.message : err);
      razorpay = { configured: true, order: null, keyId: readEnvFromContext(context, 'RAZORPAY_KEY_ID'), error: 'Razorpay did not create an order.' };
    }
    return jsonResponse({ success: true, ...prepared, razorpay });
  } catch (err) {
    const status = err?.code === 'NOT_FOUND' ? 404 : 500;
    return jsonResponse({ success: false, message: err instanceof Error ? err.message : 'Checkout could not be prepared.' }, status);
  }
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
