import { PRO_MONTHLY_CREDIT_FUP } from '../../packages/shared/src/lib/aiCredits.mjs';
import { PRO_ORDER_AMOUNT_PAISE } from './proBilling.mjs';
import { getNeonSql, hasNeonDatabase } from './neonDb.mjs';
import { hasD1Binding } from './runtimeEnv.mjs';

/**
 * @param {Record<string, unknown>} env
 * @param {string} userId
 */
export async function getUserRow(env, userId) {
  const sql = getNeonSql(env);
  if (sql) {
    const rows = await sql`SELECT id, email, plan, credits FROM users WHERE id = ${userId}`;
    return rows[0] ?? null;
  }
  if (hasD1Binding(env)) {
    return env.DB.prepare('SELECT id, email, plan, credits FROM users WHERE id = ?').bind(userId).first();
  }
  return null;
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

  if (sql) {
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

  if (hasD1Binding(env)) {
    const existing = await env.DB.prepare(
      'SELECT id FROM billing_events WHERE razorpay_order_id = ?',
    )
      .bind(orderId)
      .first();

    if (existing) {
      return { ok: true, duplicate: true };
    }

    const eventId = `be_${Date.now()}`;
    await env.DB.prepare(
      `INSERT INTO billing_events (id, razorpay_order_id, razorpay_payment_id, user_id, amount_paise, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'captured', ?)`,
    )
      .bind(eventId, orderId, paymentId, userId, PRO_ORDER_AMOUNT_PAISE, new Date().toISOString())
      .run();

    const now = new Date().toISOString();
    const result = await env.DB.prepare(
      `UPDATE users SET plan = 'pro', credits = ?, updatedAt = ? WHERE id = ?`,
    )
      .bind(PRO_MONTHLY_CREDIT_FUP, now, userId)
      .run();

    return { ok: Boolean(result.success), duplicate: false };
  }

  return { ok: false, duplicate: false };
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} orderId
 */
export async function isOrderProcessed(env, orderId) {
  const sql = getNeonSql(env);
  if (sql) {
    const rows = await sql`SELECT id FROM billing_events WHERE razorpay_order_id = ${orderId} LIMIT 1`;
    return rows.length > 0;
  }
  if (hasD1Binding(env)) {
    const row = await env.DB.prepare('SELECT id FROM billing_events WHERE razorpay_order_id = ?')
      .bind(orderId)
      .first();
    return Boolean(row);
  }
  return false;
}

/** @deprecated Use activateProFromPayment */
export async function setUserPlanPro(dbOrEnv, userId) {
  const env = dbOrEnv?.DB ? dbOrEnv : { DB: dbOrEnv };
  const result = await activateProFromPayment(env, {
    userId,
    orderId: `legacy_${userId}_${Date.now()}`,
    paymentId: null,
  });
  return result.ok;
}

export { hasNeonDatabase, hasD1Binding as hasLegacyD1 };
