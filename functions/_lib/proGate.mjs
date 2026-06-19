import { getSessionUser } from './session.mjs';
import { getRuntimeEnv, hasD1Binding } from './runtimeEnv.mjs';
import { getUserRow } from './userDb.mjs';
import { hasNeonDatabase } from './neonDb.mjs';

/**
 * Enforce Better Auth session + `plan === 'pro'`.
 * @param {Request} request
 * @param {Record<string, unknown>} context Pages/Worker handler context
 */
export async function requireProUser(request, context) {
  const env = getRuntimeEnv(context);
  const user = await getSessionUser(request, context);

  if (!user?.id) {
    return {
      ok: false,
      status: 401,
      body: { error: 'Unauthorized', message: 'Sign in required.' },
    };
  }

  if (!hasNeonDatabase(env) && !hasD1Binding(env)) {
    return {
      ok: false,
      status: 503,
      body: { error: 'Service Unavailable', message: 'Identity database is not configured.' },
    };
  }

  const row = await getUserRow(env, user.id);

  if (!row || row.plan !== 'pro') {
    return {
      ok: false,
      status: 403,
      body: { error: 'Forbidden', message: 'Pro subscription required.' },
    };
  }

  return {
    ok: true,
    user: {
      id: row.id,
      email: row.email,
      plan: row.plan,
    },
  };
}
