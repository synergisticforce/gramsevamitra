export type AppLanguage = 'en' | 'hi';
export type NumeralScript = 'latin' | 'devanagari';

export interface DisplayPrefs {
  language: AppLanguage;
  numerals: NumeralScript;
}

export const DISPLAY_PREFS_KEY = 'gsm_display_prefs';
export const DISPLAY_PREFS_EVENT = 'gsm-display-prefs';

const DEFAULTS: DisplayPrefs = { language: 'en', numerals: 'latin' };

export function readDisplayPrefs(): DisplayPrefs {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(DISPLAY_PREFS_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<DisplayPrefs>;
    return {
      language: parsed.language === 'hi' ? 'hi' : 'en',
      numerals: parsed.numerals === 'devanagari' ? 'devanagari' : 'latin',
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
