import { getOperationCreditCost, PRO_MONTHLY_CREDIT_FUP } from '../../packages/shared/src/lib/aiCredits.mjs';
import { requireProUser } from './proGate.mjs';

export { PRO_MONTHLY_CREDIT_FUP, getOperationCreditCost };

/**
 * @param {import('@gramsevamitra/auth').AuthEnv} env
 * @param {string} userId
 */
export async function getUserCreditBalance(env, userId) {
  if (!env.DB) return 0;
  const row = await env.DB.prepare('SELECT credits FROM users WHERE id = ?').bind(userId).first();
  return typeof row?.credits === 'number' ? row.credits : Number(row?.credits ?? 0);
}

/**
 * Pro session gate + sufficient AI Credits for an operation.
 * @param {Request} request
 * @param {import('@gramsevamitra/auth').AuthEnv} env
 * @param {string} operationId
 */
export async function requireProCredits(request, env, operationId) {
  const gate = await requireProUser(request, env);
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

/**
 * Atomically deduct credits after a successful Pro operation.
 * @param {import('@gramsevamitra/auth').AuthEnv} env
 * @param {string} userId
 * @param {number} amount
 * @returns {Promise<number | null>} new balance or null if deduction failed
 */
export async function deductUserCredits(env, userId, amount) {
  if (!env.DB || amount <= 0) {
    return null;
  }

  const now = new Date().toISOString();
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

/**
 * @param {import('@gramsevamitra/auth').AuthEnv} env
 * @param {string} userId
 * @param {string} operationId
 */
export async function deductOperationCredits(env, userId, operationId) {
  const cost = getOperationCreditCost(operationId);
  return deductUserCredits(env, userId, cost);
}

/**
 * Grant monthly FUP credits when activating Pro.
 * @param {D1Database} db
 * @param {string} userId
 */
export async function grantProMonthlyCredits(db, userId) {
  const now = new Date().toISOString();
  const result = await db
    .prepare(`UPDATE users SET credits = ?, updatedAt = ? WHERE id = ?`)
    .bind(PRO_MONTHLY_CREDIT_FUP, now, userId)
    .run();
  return result.success;
}
