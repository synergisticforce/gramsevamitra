/**
 * Resolve Cloudflare Pages / Workers bindings from a function handler context.
 * Never rely on `process.env` on the edge — it is undefined in production.
 *
 * @param {Record<string, unknown> | undefined} context Handler context from onRequest
 * @returns {Record<string, string | undefined>}
 */
export function getRuntimeEnv(context) {
  /** @type {Record<string, string | undefined>[]} */
  const layers = [];

  const pushLayer = (source) => {
    if (!source || typeof source !== 'object') return;
    /** @type {Record<string, string | undefined>} */
    const layer = {};
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === 'string' && value.length > 0) {
        layer[key] = value;
      }
    }
    if (Object.keys(layer).length > 0) layers.push(layer);
  };

  pushLayer(context?.env);
  pushLayer(context?.cloudflare?.env);

  const locals = context?.locals;
  if (locals && typeof locals === 'object') {
    pushLayer(locals.runtime?.env);
    pushLayer(locals.env);
  }

  /** @type {Record<string, string | undefined>} */
  const merged = {};
  for (const layer of layers) {
    Object.assign(merged, layer);
  }

  return merged;
}

/**
 * @param {Record<string, unknown> | undefined} context
 * @returns {string[]}
 */
export function getRuntimeEnvSourceLabels(context) {
  /** @type {string[]} */
  const labels = [];
  if (context?.env && typeof context.env === 'object') labels.push('context.env');
  if (context?.cloudflare?.env && typeof context.cloudflare.env === 'object') {
    labels.push('context.cloudflare.env');
  }
  if (context?.locals?.runtime?.env) labels.push('context.locals.runtime.env');
  if (context?.locals?.env) labels.push('context.locals.env');
  return labels;
}
