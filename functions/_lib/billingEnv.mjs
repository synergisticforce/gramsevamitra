/**
 * Resolve Razorpay credentials from Cloudflare Pages env bindings.
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
