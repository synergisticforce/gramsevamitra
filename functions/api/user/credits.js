import { jsonResponse } from '../../_lib/json.mjs';
import { getUserCreditBalance, getUserRow } from '../../_lib/userDb.mjs';
import { getSessionUser } from '../../_lib/session.mjs';
import { getRuntimeEnv, hasD1Binding } from '../../_lib/runtimeEnv.mjs';
import { hasNeonDatabase } from '../../_lib/neonDb.mjs';
import { PRO_MONTHLY_CREDIT_FUP } from '../../../packages/shared/src/lib/aiCredits.mjs';

export async function onRequestGet(context) {
  const { request } = context;
  const env = getRuntimeEnv(context);
  const user = await getSessionUser(request, context);

  if (!user?.id) {
    return jsonResponse({ error: 'Unauthorized', message: 'Sign in required.' }, 401);
  }

  if (!hasNeonDatabase(env) && !hasD1Binding(env)) {
    return jsonResponse({ error: 'Service Unavailable', message: 'Identity database is not configured.' }, 503);
  }

  const row = await getUserRow(env, user.id);
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
