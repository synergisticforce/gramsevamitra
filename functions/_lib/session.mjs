import { createAuth } from './auth.mjs';
import {
  getRuntimeEnv,
  getRuntimeEnvSourceLabels,
  hasD1Binding,
} from './runtimeEnv.mjs';
import { hasNeonDatabase } from './neonDb.mjs';

/**
 * Resolve the signed-in Better Auth user from request cookies/headers.
 * @param {Request} request
 * @param {Record<string, unknown>} context Handler context from onRequest
 */
export async function getSessionUser(request, context) {
  const env = getRuntimeEnv(context);

  if (!hasNeonDatabase(env) && !hasD1Binding(env)) {
    console.error('[auth] Session lookup aborted: database not configured', {
      envSources: getRuntimeEnvSourceLabels(context),
    });
    return null;
  }

  try {
    const auth = createAuth(env);
    const session = await auth.api.getSession({ headers: request.headers });
    return session?.user ?? null;
  } catch (err) {
    console.error('[auth] getSession failed', {
      message: err instanceof Error ? err.message : String(err),
      envSources: getRuntimeEnvSourceLabels(context),
    });
    return null;
  }
}
