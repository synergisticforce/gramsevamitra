import { getOperationCreditCost, PRO_MONTHLY_CREDIT_FUP } from '../../packages/shared/src/lib/aiCredits.mjs';
import { getRuntimeEnv } from './runtimeEnv.mjs';
import { requireProUser } from './proGate.mjs';
import { getUserCreditBalance, getUserRow } from './userDb.mjs';
import { hasD1Binding } from './runtimeEnv.mjs';
import { getNeonSql } from './neonDb.mjs';

export { PRO_MONTHLY_CREDIT_FUP, getOperationCreditCost };

/**
 * @param {Record<string, unknown>} env
 * @param {string} userId
 */
export async function deductUserCredits(env, userId, amount) {
  if (amount <= 0) return null;

  const sql = getNeonSql(env);
  const now = new Date().toISOString();

  if (sql) {
    const rows = await sql`
      UPDATE users
      SET credits = credits - ${amount}, "updatedAt" = NOW()
      WHERE id = ${userId} AND credits >= ${amount}
      RETURNING credits
    `;
    if (rows.length === 0) return null;
    return Number(rows[0].credits);
  }

  if (hasD1Binding(env)) {
    const result = await env.DB.prepare(
      `UPDATE users SET credits = credits - ?, updatedAt = ? WHERE id = ? AND credits >= ?`,
    )
      .bind(amount, now, userId, amount)
      .run();

    if (!result.success || (result.meta?.changes ?? 0) === 0) {
      return null;
    }
    return getUserCreditBalance(env, userId);
  }

  return null;
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} userId
 * @param {string} operationId
 */
export async function deductOperationCredits(env, userId, operationId) {
  const cost = getOperationCreditCost(operationId);
  return deductUserCredits(env, userId, cost);
}

/**
 * Pro session gate + sufficient AI Credits for an operation.
 */
export async function requireProCredits(request, context, operationId) {
  const env = getRuntimeEnv(context);
  const gate = await requireProUser(request, context);
  if (!gate.ok) {
    return gate;
  }

  const cost = getOperationCreditCost(operationId);
  const remainingCredits = await getUserCreditBalance(env, gate.user.id);

  if (remainingCredits < cost) {
    return {
      ok: false,
      status: 402,
      body: {
        error: 'Payment Required',
        message: `Insufficient AI Credits. This operation requires ${cost} credit${cost === 1 ? '' : 's'}; you have ${remainingCredits}.`,
        operationId,
        requiredCredits: cost,
        remainingCredits,
      },
    };
  }

  return {
    ok: true,
    user: gate.user,
    operationId,
    cost,
    remainingCredits,
  };
}

export { getUserCreditBalance, getUserRow };
