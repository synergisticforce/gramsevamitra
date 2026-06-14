import { jsonResponse } from '../../_lib/json.mjs';
import { getUserCreditBalance } from '../../_lib/creditEconomy.mjs';
import { getSessionUser } from '../../_lib/session.mjs';
import { PRO_MONTHLY_CREDIT_FUP } from '../../../packages/shared/src/lib/aiCredits.mjs';

export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await getSessionUser(request, env);

  if (!user?.id) {
    return jsonResponse({ error: 'Unauthorized', message: 'Sign in required.' }, 401);
  }

  if (!env.DB) {
    return jsonResponse({ error: 'Service Unavailable', message: 'Identity database is not bound.' }, 503);
  }

  const row = await env.DB.prepare('SELECT plan, credits FROM users WHERE id = ?').bind(user.id).first();
  const plan = row?.plan ?? 'free';
  const credits = await getUserCreditBalance(env, user.id);

  return jsonResponse({
    success: true,
    credits,
    plan,
    monthlyAllowance: PRO_MONTHLY_CREDIT_FUP,
  });
}

export async function onRequest(context) {
  if (context.request.method === 'GET') {
    return onRequestGet(context);
  }
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
