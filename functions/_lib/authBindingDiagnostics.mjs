import { getRuntimeEnvSourceLabels, getRuntimeEnvLayers, readEnvFromContext, readEnvString } from './runtimeEnv.mjs';

const AUTH_BINDING_KEYS = [
  'BETTER_AUTH_URL',
  'BETTER_AUTH_SECRET',
  'DATABASE_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
];

/**
 * Non-secret probe of auth-related Cloudflare bindings across env layers.
 * @param {Record<string, unknown> | undefined} context
 */
export function probeAuthBindings(context) {
  const layers = getRuntimeEnvLayers(context);
  const layerLabels = getRuntimeEnvSourceLabels(context);

  /** @type {Record<string, { present: boolean; layer: string | null }>} */
  const bindings = {};

  for (const key of AUTH_BINDING_KEYS) {
    let layer = null;
    for (let index = 0; index < layers.length; index += 1) {
      if (readEnvString(layers[index], key)) {
        layer = layerLabels[index] ?? `layer-${index}`;
        break;
      }
    }
    bindings[key] = {
      present: Boolean(readEnvFromContext(context, key)),
      layer,
    };
  }

  return bindings;
}

/**
 * @param {Record<string, unknown> | undefined} context
 * @param {string} [prefix]
 */
export function logAuthBindingDiagnostics(context, prefix = '[auth]') {
  console.error(`${prefix} binding diagnostics`, probeAuthBindings(context));
}
