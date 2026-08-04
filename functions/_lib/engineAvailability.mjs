/**
 * Guards Pro endpoints whose real inference engine is not wired up yet.
 *
 * Several Pro handlers still ship placeholder pipelines that echo the input or
 * return sample data. Charging AI Credits for those would bill users for work
 * that never happened, so every such route must call `requireEngine()` BEFORE
 * any credit deduction and return the result verbatim when it is not ready.
 */

/** @param {Record<string, unknown>} env @param {string} name */
function hasEnv(env, name) {
  const value = env?.[name];
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Engine id → the environment variable that proves a real backend exists.
 * Add the variable in Cloudflare Pages to switch a feature on.
 */
const ENGINE_ENV_REQUIREMENTS = {
  'media-ai': ['MEDIA_AI_ENDPOINT'],
  'layout-reconstruction': ['LAYOUT_RECONSTRUCTION_ENDPOINT'],
  'ocr-waterfall': ['PADDLE_OCR_ENDPOINT', 'GOOGLE_VISION_API_KEY'],
};

const ENGINE_LABELS = {
  'media-ai': 'AI photo enhancement',
  'layout-reconstruction': 'spreadsheet layout reconstruction',
  'ocr-waterfall': 'advanced OCR extraction',
};

/**
 * @param {Record<string, unknown>} env
 * @param {keyof typeof ENGINE_ENV_REQUIREMENTS} engineId
 */
export function isEngineConfigured(env, engineId) {
  const required = ENGINE_ENV_REQUIREMENTS[engineId];
  if (!required) return false;
  return required.some((name) => hasEnv(env, name));
}

/**
 * Returns `null` when the engine is ready, otherwise a `{ status, body }`
 * describing the outage in language a non-technical user can act on.
 *
 * @param {Record<string, unknown>} env
 * @param {keyof typeof ENGINE_ENV_REQUIREMENTS} engineId
 */
export function requireEngine(env, engineId) {
  if (isEngineConfigured(env, engineId)) return null;

  const label = ENGINE_LABELS[engineId] ?? 'this Pro feature';
  return {
    status: 503,
    body: {
      success: false,
      error: 'Service Unavailable',
      code: 'ENGINE_NOT_READY',
      engineId,
      creditsCharged: 0,
      message: `${label} is not available yet. You have not been charged any AI Credits.`,
    },
  };
}
