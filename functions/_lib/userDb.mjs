import { PRO_MONTHLY_CREDIT_FUP } from '../../packages/shared/src/lib/aiCredits.mjs';
import { PRO_ORDER_AMOUNT_PAISE } from './proBilling.mjs';
import { getNeonSql, hasNeonDatabase } from './neonDb.mjs';

/**
 * Accounts, credits, and Razorpay rows live only in Neon PostgreSQL.
 * Cloudflare D1 is not a billing or auth fallback.
 * @param {Record<string, unknown>} env
 * @param {string} userId
 */
export async function getUserRow(env, userId) {
  const sql = getNeonSql(env);
  if (!sql) return null;
  const rows = await sql`SELECT id, email, plan, credits FROM users WHERE id = ${userId}`;
  return rows[0] ?? null;
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} userId
 */
export async function getUserCreditBalance(env, userId) {
  const row = await getUserRow(env, userId);
  if (!row) return 0;
  return typeof row.credits === 'number' ? row.credits : Number(row.credits ?? 0);
}

/**
 * Idempotent Pro activation after verified Razorpay payment.
 * @param {Record<string, unknown>} env
 * @param {{ userId: string; orderId: string; paymentId?: string }} input
 */
export async function activateProFromPayment(env, input) {
  const { userId, orderId, paymentId = null } = input;
  const sql = getNeonSql(env);
  if (!sql) return { ok: false, duplicate: false };

  const inserted = await sql`
    INSERT INTO billing_events (razorpay_order_id, razorpay_payment_id, user_id, amount_paise, status)
    VALUES (${orderId}, ${paymentId}, ${userId}, ${PRO_ORDER_AMOUNT_PAISE}, 'captured')
    ON CONFLICT (razorpay_order_id) DO NOTHING
    RETURNING id
  `;

  if (inserted.length === 0) {
    return { ok: true, duplicate: true };
  }

  await sql`
    UPDATE users
    SET plan = 'pro', credits = ${PRO_MONTHLY_CREDIT_FUP}, "updatedAt" = NOW()
    WHERE id = ${userId}
  `;
  return { ok: true, duplicate: false };
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} orderId
 */
export async function isOrderProcessed(env, orderId) {
  const sql = getNeonSql(env);
  if (!sql) return false;
  const rows = await sql`SELECT id FROM billing_events WHERE razorpay_order_id = ${orderId} LIMIT 1`;
  return rows.length > 0;
}

/** @deprecated Use activateProFromPayment */
export async function setUserPlanPro(env, userId) {
  const result = await activateProFromPayment(env, {
    userId,
    orderId: `legacy_${userId}_${Date.now()}`,
    paymentId: null,
  });
  return result.ok;
}

export { hasNeonDatabase };
