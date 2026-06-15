import { getRuntimeEnv, getRuntimeEnvSourceLabels } from './runtimeEnv.mjs';

/**
 * Resolve Razorpay credentials from Cloudflare runtime bindings.
 * PUBLIC_RAZORPAY_KEY_ID (build-time) can backfill RAZORPAY_KEY_ID when the secret binding is missing.
 * @param {Record<string, string | undefined>} env
 */
export function resolveRazorpayCredentials(env) {
  const keyId = String(env.RAZORPAY_KEY_ID || env.PUBLIC_RAZORPAY_KEY_ID || '').trim();
  const keySecret = String(env.RAZORPAY_KEY_SECRET || '').trim();
  return { keyId, keySecret };
}

/**
 * @param {Record<string, string | undefined>} env
 */
export function getBillingConfigDiagnostics(env) {
  const { keyId, keySecret } = resolveRazorpayCredentials(env);
  /** @type {string[]} */
  const missing = [];
  if (!keyId) missing.push('RAZORPAY_KEY_ID or PUBLIC_RAZORPAY_KEY_ID');
  if (!keySecret) missing.push('RAZORPAY_KEY_SECRET');
  return {
    configured: missing.length === 0,
    missing,
    keyId,
    keySecret,
  };
}

/**
 * @param {Record<string, string | undefined>} env
 */
export function withRazorpayEnv(env) {
  const { keyId, keySecret } = resolveRazorpayCredentials(env);
  return {
    ...env,
    RAZORPAY_KEY_ID: keyId,
    RAZORPAY_KEY_SECRET: keySecret,
  };
}

/**
 * Resolve billing env from a Pages/Worker handler context (not process.env).
 * @param {Record<string, unknown> | undefined} context
 */
export function getBillingEnvFromContext(context) {
  return getRuntimeEnv(context);
}

/**
 * Server-side diagnostics for Cloudflare logs only — never return to clients.
 * @param {Record<string, unknown> | undefined} context
 * @param {ReturnType<typeof getBillingConfigDiagnostics>} billing
 */
export function logBillingConfigFailure(context, billing) {
  console.error('[billing] Razorpay credentials unavailable', {
    missing: billing.missing,
    envSources: getRuntimeEnvSourceLabels(context),
    hasKeyId: Boolean(billing.keyId),
    hasKeySecret: Boolean(billing.keySecret),
    keyIdPrefix: billing.keyId ? `${billing.keyId.slice(0, 8)}…` : null,
  });
}
