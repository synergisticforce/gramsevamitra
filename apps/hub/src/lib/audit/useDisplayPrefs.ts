import { useEffect, useState } from 'react';
import {
  DISPLAY_PREFS_EVENT,
  readDisplayPrefs,
  writeDisplayPrefs,
  type AppLanguage,
  type CurrencyCode,
  type NumeralScript,
} from './displayPrefs';

export function useDisplayPrefs() {
  const [prefs, setPrefs] = useState(readDisplayPrefs);

  useEffect(() => {
    const sync = () => setPrefs(readDisplayPrefs());
    sync();
    window.addEventListener(DISPLAY_PREFS_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(DISPLAY_PREFS_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return {
    ...prefs,
    indic: prefs.numerals === 'devanagari',
    hindi: prefs.language === 'hi',
    setLanguage: (language: AppLanguage) => writeDisplayPrefs({ ...readDisplayPrefs(), language }),
    setNumerals: (numerals: NumeralScript) => writeDisplayPrefs({ ...readDisplayPrefs(), numerals }),
    setCurrency: (currency: CurrencyCode) => writeDisplayPrefs({ ...readDisplayPrefs(), currency }),
    setSimpleMode: (simpleMode: boolean) => writeDisplayPrefs({ ...readDisplayPrefs(), simpleMode }),
  };
}
