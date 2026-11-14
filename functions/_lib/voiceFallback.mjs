const VOICE_LANG = {
  en: 'en-IN',
  hi: 'hi-IN',
  bn: 'bn-IN',
  ta: 'ta-IN',
  mr: 'mr-IN',
  es: 'es-ES',
  fr: 'fr-FR',
  sw: 'sw-KE',
  ar: 'ar-SA',
};

/**
 * @param {string} [langCode]
 * @param {Array<{ lang?: string }>} [voices]
 */
export function resolveSpeakLanguage(langCode = 'en', voices = []) {
  const wanted = VOICE_LANG[langCode] || langCode || 'en-IN';
  const list = Array.isArray(voices) ? voices : [];
  const has = (prefix) => list.some((voice) => String(voice?.lang || '').toLowerCase().startsWith(String(prefix).toLowerCase()));
  if (list.length && has(wanted)) return { lang: wanted, fallback: false };
  if (has('en-IN')) return { lang: 'en-IN', fallback: wanted !== 'en-IN' };
  if (has('en-US') || has('en')) return { lang: 'en-US', fallback: true };
  return { lang: 'en-US', fallback: list.length > 0 };
}