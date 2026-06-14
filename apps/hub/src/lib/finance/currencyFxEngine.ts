/** Client-side FX rates via open.er-api.com with localStorage cache fallback. */

export const FX_RATES_CACHE_KEY = 'gsm-finance-fx-rates-cache';
export const FX_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
export const ER_API_LATEST = 'https://open.er-api.com/v6/latest/USD';

export const POPULAR_INR_REFS = ['USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'AUD', 'CAD'];

export interface RatesCache {
  fetchedAt: number;
  base: string;
  rates: Record<string, number>;
}

interface ErApiResponse {
  result: string;
  base_code: string;
  rates: Record<string, number>;
  time_last_update_utc?: string;
}

export function readFxCache(allowStale = false): RatesCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(FX_RATES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RatesCache;
    if (!allowStale && Date.now() - parsed.fetchedAt > FX_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeFxCache(rates: Record<string, number>, base: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      FX_RATES_CACHE_KEY,
      JSON.stringify({ fetchedAt: Date.now(), base, rates } satisfies RatesCache)
    );
  } catch {
    /* ignore */
  }
}

export async function fetchFxRates(): Promise<{
  rates: Record<string, number>;
  updatedAt: Date;
  fromCache: boolean;
  stale: boolean;
}> {
  const fresh = readFxCache(false);
  if (fresh) {
    return { rates: fresh.rates, updatedAt: new Date(fresh.fetchedAt), fromCache: true, stale: false };
  }

  try {
    const res = await fetch(ER_API_LATEST, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Rates unavailable (${res.status})`);
    const data = (await res.json()) as ErApiResponse;
    if (data.result !== 'success' || !data.rates) throw new Error('Rates unavailable');
    const rates = { ...data.rates };
    if (!rates[data.base_code]) rates[data.base_code] = 1;
    writeFxCache(rates, data.base_code);
    const updatedAt = data.time_last_update_utc ? new Date(data.time_last_update_utc) : new Date();
    return { rates, updatedAt, fromCache: false, stale: false };
  } catch {
    const stale = readFxCache(true);
    if (stale) {
      return {
        rates: stale.rates,
        updatedAt: new Date(stale.fetchedAt),
        fromCache: true,
        stale: true,
      };
    }
    throw new Error('Unable to load exchange rates. Check your connection.');
  }
}

export function convertFxAmount(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>
): { converted: number; rate: number; inverseRate: number } | null {
  const fromRate = rates[from];
  const toRate = rates[to];
  if (!fromRate || !toRate) return null;
  const usdValue = amount / fromRate;
  const converted = usdValue * toRate;
  const rate = toRate / fromRate;
  return { converted, rate, inverseRate: 1 / rate };
}

export function formatFxAmount(value: number, currency: string): string {
  if (!Number.isFinite(value)) return '—';
  const zeroDec = ['JPY', 'KRW', 'IDR', 'VND'].includes(currency);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: zeroDec ? 0 : 2,
      maximumFractionDigits: zeroDec ? 0 : 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function formatFxRate(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 }).format(
    value
  );
}
