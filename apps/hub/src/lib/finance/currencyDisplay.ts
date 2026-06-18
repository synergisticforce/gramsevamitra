/** Human-readable currency labels for Finance Hub FX UI. */

const FALLBACK_NAMES: Record<string, string> = {
  XAF: 'Central African CFA Franc',
  XOF: 'West African CFA Franc',
  XPF: 'CFP Franc',
};

let currencyNames: Intl.DisplayNames | null | undefined;

function getCurrencyNames(): Intl.DisplayNames | null {
  if (currencyNames !== undefined) return currencyNames;
  try {
    currencyNames = new Intl.DisplayNames(['en'], { type: 'currency' });
  } catch {
    currencyNames = null;
  }
  return currencyNames;
}

const symbolCache = new Map<string, string>();

export function getCurrencyName(code: string): string {
  try {
    const label = getCurrencyNames()?.of(code);
    if (label && label !== code) return label;
  } catch {
    /* Intl unavailable */
  }
  return FALLBACK_NAMES[code] ?? code;
}

export function getCurrencySymbol(code: string): string {
  const cached = symbolCache.get(code);
  if (cached) return cached;

  try {
    const parts = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(1);
    const symbol = parts.find((part) => part.type === 'currency')?.value?.trim() ?? code;
    symbolCache.set(code, symbol);
    return symbol;
  } catch {
    return code;
  }
}

/** e.g. `INR - Indian Rupee (₹)` */
export function formatCurrencyLabel(code: string): string {
  return `${code} - ${getCurrencyName(code)} (${getCurrencySymbol(code)})`;
}
