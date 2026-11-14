export type AppLanguage = 'en' | 'hi' | 'bn' | 'ta' | 'mr' | 'es' | 'fr' | 'sw' | 'ar';
export type NumeralScript = 'latin' | 'devanagari';
export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'NGN';

export interface DisplayPrefs {
  language: AppLanguage;
  numerals: NumeralScript;
  currency: CurrencyCode;
  simpleMode: boolean;
}

export const DISPLAY_PREFS_KEY = 'gsm_display_prefs';
export const DISPLAY_PREFS_EVENT = 'gsm-display-prefs';
export const SELLER_BANNER_KEY = 'gsm_hide_seller_banner';

const LANGUAGES = new Set<AppLanguage>(['en', 'hi', 'bn', 'ta', 'mr', 'es', 'fr', 'sw', 'ar']);
const CURRENCIES = new Set<CurrencyCode>(['INR', 'USD', 'EUR', 'GBP', 'NGN']);

const DEFAULTS: DisplayPrefs = { language: 'en', numerals: 'latin', currency: 'INR', simpleMode: false };

export function readDisplayPrefs(): DisplayPrefs {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(DISPLAY_PREFS_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<DisplayPrefs>;
    const language = LANGUAGES.has(parsed.language as AppLanguage) ? (parsed.language as AppLanguage) : 'en';
    return {
      language,
      numerals: parsed.numerals === 'devanagari' ? 'devanagari' : 'latin',
      currency: CURRENCIES.has(parsed.currency as CurrencyCode) ? (parsed.currency as CurrencyCode) : 'INR',
      simpleMode: parsed.simpleMode === true,
    };
  } catch {
    return DEFAULTS;
  }
}

export function writeDisplayPrefs(next: DisplayPrefs) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DISPLAY_PREFS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(DISPLAY_PREFS_EVENT));
}
