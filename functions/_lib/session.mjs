import { createAuth } from './auth.mjs';

/**
 * Resolve the signed-in Better Auth user from request cookies/headers.
 * @param {Request} request
 * @param {import('@gramsevamitra/auth').AuthEnv} env
 */
export async function getSessionUser(request, env) {
  const auth = createAuth(env);
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user ?? null;
}
