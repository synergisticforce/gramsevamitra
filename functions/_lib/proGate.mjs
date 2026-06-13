import { getSessionUser } from './session.mjs';

/**
 * Enforce Better Auth session + D1 `plan === 'pro'`.
 * @param {Request} request
 * @param {import('@gramsevamitra/auth').AuthEnv} env
 */
export async function requireProUser(request, env) {
  const user = await getSessionUser(request, env);

  if (!user?.id) {
    return {
      ok: false,
      status: 401,
      body: { error: 'Unauthorized', message: 'Sign in required.' },
    };
  }

  if (!env.DB) {
    return {
      ok: false,
      status: 503,
      body: { error: 'Service Unavailable', message: 'Identity database is not bound.' },
    };
  }

  const row = await env.DB.prepare('SELECT id, email, plan FROM users WHERE id = ?')
    .bind(user.id)
    .first();

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
