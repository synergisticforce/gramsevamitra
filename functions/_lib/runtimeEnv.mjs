/** @typedef {Record<string, unknown>} CloudflareBindings */

/**
 * Read a string binding directly — never enumerate `env` (secrets are not always enumerable).
 * @param {CloudflareBindings | null | undefined} source
 * @param {string} key
 */
export function readEnvString(source, key) {
  if (!source || typeof source !== 'object') return '';
  const value = source[key];
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * @param {CloudflareBindings | null | undefined} env
 */
export function hasD1Binding(env) {
  const db = env?.DB;
  return Boolean(db && typeof db.prepare === 'function');
}

/**
 * Ordered Cloudflare env layers from a Pages/Worker handler context.
 * @param {Record<string, unknown> | undefined} context
 * @returns {CloudflareBindings[]}
 */
export function getRuntimeEnvLayers(context) {
  return [
    context?.env,
    context?.locals?.runtime?.env,
    context?.cloudflare?.env,
    context?.locals?.env,
  ].filter((layer) => layer && typeof layer === 'object');
}

/**
 * Read a binding from the first env layer that defines it (secrets may live on a different layer than D1).
 * @param {Record<string, unknown> | undefined} context
 * @param {string} key
 */
export function readEnvFromContext(context, key) {
  for (const layer of getRuntimeEnvLayers(context)) {
    const value = readEnvString(layer, key);
    if (value) return value;
  }
  return '';
}

/**
 * Return the native Cloudflare runtime bindings object from a Pages/Worker handler context.
 * Prefer Neon (`DATABASE_URL`) over D1 so production auth never silently falls back to an empty D1 store.
 * Never clone or spread `env` — bindings (D1, R2, secrets) must stay on the native object.
 * Never rely on `process.env` on the edge — it is undefined in production.
 *
 * @param {Record<string, unknown> | undefined} context Handler context from onRequest
 * @returns {CloudflareBindings}
 */
export function getRuntimeEnv(context) {
  const layers = getRuntimeEnvLayers(context);
  const withNeon = layers.find((layer) => readEnvString(layer, 'DATABASE_URL'));
  if (withNeon) {
    return /** @type {CloudflareBindings} */ (withNeon);
  }

  const withDb = layers.find(hasD1Binding);
  if (withDb) {
    return /** @type {CloudflareBindings} */ (withDb);
  }

  return /** @type {CloudflareBindings} */ (layers[0] ?? {});
}

/**
 * @param {Record<string, unknown> | undefined} context
 */
export function hasNeonDatabaseInContext(context) {
  return Boolean(readEnvFromContext(context, 'DATABASE_URL'));
}

/** Alias used by auth/billing handlers. */
export const getHandlerEnv = getRuntimeEnv;

/**
 * @param {Record<string, unknown> | undefined} context
 * @returns {string[]}
 */
export function getRuntimeEnvSourceLabels(context) {
  /** @type {string[]} */
  const labels = [];
  if (context?.env && typeof context.env === 'object') {
    labels.push(hasD1Binding(context.env) ? 'context.env (DB)' : 'context.env');
  }
  if (context?.locals?.runtime?.env) {
    labels.push(
      hasD1Binding(context.locals.runtime.env)
        ? 'context.locals.runtime.env (DB)'
        : 'context.locals.runtime.env',
    );
  }
  if (context?.cloudflare?.env && typeof context.cloudflare.env === 'object') {
    labels.push(
      hasD1Binding(context.cloudflare.env) ? 'context.cloudflare.env (DB)' : 'context.cloudflare.env',
    );
  }
  if (context?.locals?.env) {
    labels.push(hasD1Binding(context.locals.env) ? 'context.locals.env (DB)' : 'context.locals.env');
  }
  return labels;
}

/**
 * Server-side probe for Cloudflare logs — checks direct property access without exposing values.
 * @param {Record<string, unknown> | undefined} context
 */
export function probeSecretBindings(context) {
  const env = getRuntimeEnv(context);
  return {
    hasRazorpayKeyId: Boolean(readEnvString(env, 'RAZORPAY_KEY_ID') || readEnvString(env, 'PUBLIC_RAZORPAY_KEY_ID')),
    hasRazorpayKeySecret: Boolean(readEnvString(env, 'RAZORPAY_KEY_SECRET')),
    hasRazorpayWebhookSecret: Boolean(readEnvString(env, 'RAZORPAY_WEBHOOK_SECRET')),
  };
}
