import { createAuth } from './auth.mjs';
import {
  getRuntimeEnvSourceLabels,
  hasD1Binding,
  hasNeonDatabaseInContext,
} from './runtimeEnv.mjs';

/**
 * Resolve the signed-in Better Auth user from request cookies/headers.
 * @param {Request} request
 * @param {Record<string, unknown>} context Handler context from onRequest
 */
export async function getSessionUser(request, context) {
  if (!hasNeonDatabaseInContext(context) && !hasD1Binding(context?.env ?? context?.cloudflare?.env)) {
    console.error('[auth] Session lookup aborted: database not configured', {
      envSources: getRuntimeEnvSourceLabels(context),
    });
    return null;
  }

  try {
    const auth = createAuth(context);
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
