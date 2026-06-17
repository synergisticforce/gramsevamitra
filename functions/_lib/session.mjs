import { createAuth } from './auth.mjs';
import {
  getRuntimeEnv,
  getRuntimeEnvSourceLabels,
  hasD1Binding,
} from './runtimeEnv.mjs';

/**
 * Resolve the signed-in Better Auth user from request cookies/headers.
 * Always pass the full Pages/Worker handler `context` so D1 bindings resolve correctly.
 *
 * @param {Request} request
 * @param {Record<string, unknown>} context Handler context from onRequest
 */
export async function getSessionUser(request, context) {
  const env = getRuntimeEnv(context);

  if (!hasD1Binding(env)) {
    console.error('[auth] Session lookup aborted: D1 DB binding missing', {
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
      hasDbBinding: hasD1Binding(env),
    });
    return null;
  }
}
