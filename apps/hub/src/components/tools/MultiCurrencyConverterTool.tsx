import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'gsm-tools:multi-currency';
const RATES_CACHE_KEY = 'gsm-tools:fx-rates-cache';
const ER_API_LATEST = 'https://open.er-api.com/v6/latest/USD';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

const POPULAR_INR_REFS = ['USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'AUD', 'CAD'];

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'CHF ',
  CNY: '¥',
  AED: 'AED ',
  SGD: 'S$',
  HKD: 'HK$',
  KRW: '₩',
};

const DEFAULTS = { amount: 100, from: 'USD', to: 'INR' };

interface SavedState {
  amount: number;
  from: string;
  to: string;
}

interface RatesCache {
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

function formatAmount(value: number, currency: string): string {
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
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: zeroDec ? 0 : 2,
      maximumFractionDigits: zeroDec ? 0 : 2,
    }).format(value);
    return `${CURRENCY_SYMBOLS[currency] ?? `${currency} `}${formatted}`;
  }
}

function formatRate(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 }).format(value);
}

function readCache(): RatesCache | null {
  try {
    const raw = localStorage.getItem(RATES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RatesCache;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(rates: Record<string, number>, base: string): void {
  try {
    localStorage.setItem(
      RATES_CACHE_KEY,
      JSON.stringify({ fetchedAt: Date.now(), base, rates } satisfies RatesCache)
    );
  } catch {
    /* ignore */
  }
}

async function fetchLiveRates(): Promise<{ rates: Record<string, number>; updatedAt: Date }> {
  const cached = readCache();
  if (cached) {
    return { rates: cached.rates, updatedAt: new Date(cached.fetchedAt) };
  }

  const res = await fetch(ER_API_LATEST, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Rates unavailable (${res.status})`);
  const data = (await res.json()) as ErApiResponse;
  if (data.result !== 'success' || !data.rates) {
    throw new Error('Rates unavailable');
  }
  const rates = { ...data.rates };
  if (!rates[data.base_code]) rates[data.base_code] = 1;
  writeCache(rates, data.base_code);
  const updatedAt = data.time_last_update_utc ? new Date(data.time_last_update_utc) : new Date();
  return { rates, updatedAt };
}

function convertAmount(
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

export default function MultiCurrencyConverterTool() {
  const [amount, setAmount] = useState(String(DEFAULTS.amount));
  const [from, setFrom] = useState(DEFAULTS.from);
  const [to, setTo] = useState(DEFAULTS.to);
  const [usdRates, setUsdRates] = useState<Record<string, number> | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<string>('');
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [loadingRates, setLoadingRates] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<SavedState>;
      if (typeof parsed.amount === 'number' && parsed.amount >= 0) {
        setAmount(String(parsed.amount));
      }
      if (parsed.from) setFrom(parsed.from);
      if (parsed.to) setTo(parsed.to);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoadingRates(true);
      setRatesError(null);
      try {
        const { rates, updatedAt } = await fetchLiveRates();
        if (cancelled) return;
        setUsdRates(rates);
        setCodes(Object.keys(rates).sort());
        setRatesUpdatedAt(
          updatedAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
        );
      } catch {
        if (!cancelled) {
          setRatesError('Unable to load live exchange rates. Check your connection and try again.');
          setUsdRates(null);
        }
      } finally {
        if (!cancelled) setLoadingRates(false);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  const amountNum = Math.max(0, Number(amount) || 0);

  const result = useMemo(() => {
    if (!usdRates || amountNum <= 0) return null;
    return convertAmount(amountNum, from, to, usdRates);
  }, [usdRates, amountNum, from, to]);

  const persist = useCallback((next: SavedState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const handleAmount = (value: string) => {
    setAmount(value);
    persist({ amount: Math.max(0, Number(value) || 0), from, to });
  };

  const handleFrom = (value: string) => {
    setFrom(value);
    persist({ amount: amountNum, from: value, to });
  };

  const handleTo = (value: string) => {
    setTo(value);
    persist({ amount: amountNum, from, to: value });
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
    persist({ amount: amountNum, from: to, to: from });
  };

  const reset = () => {
    setAmount(String(DEFAULTS.amount));
    setFrom(DEFAULTS.from);
    setTo(DEFAULTS.to);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-800 bg-canvas-accent-muted/60 p-5 shadow-none sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-subtle">Convert</h2>

        {loadingRates && (
          <p className="mt-3 text-sm text-canvas-accent" role="status">
            Loading live rates…
          </p>
        )}
        {ratesError && (
          <p className="mt-3 rounded-lg border border-rose-800/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-300" role="alert">
            {ratesError}
          </p>
        )}
        {!loadingRates && !ratesError && ratesUpdatedAt && (
          <p className="mt-3 text-xs font-medium leading-relaxed text-slate-300" role="status">
            Rates updated: {ratesUpdatedAt} — Sourced from public markets.
          </p>
        )}

        <div className="mt-5 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-canvas-muted">Amount</span>
            <input
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={amount}
              onChange={(e) => handleAmount(e.target.value)}
              disabled={!usdRates}
              className="input-field w-full tabular-nums"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="min-w-0">
              <span className="mb-2 block text-sm font-medium text-canvas-muted">From</span>
              <select
                value={from}
                onChange={(e) => handleFrom(e.target.value)}
                disabled={!usdRates}
                className="select-field w-full py-2.5 text-sm"
              >
                {codes.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0">
              <span className="mb-2 block text-sm font-medium text-canvas-muted">To</span>
              <select
                value={to}
                onChange={(e) => handleTo(e.target.value)}
                disabled={!usdRates}
                className="select-field w-full py-2.5 text-sm"
              >
                {codes.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button type="button" onClick={swap} disabled={!usdRates} className="btn-secondary w-full text-sm">
            ⇅ Swap currencies
          </button>
        </div>

        <button type="button" onClick={reset} className="btn-secondary mt-6 w-full text-sm">
          Reset
        </button>
      </section>

      <section className="rounded-2xl border border-canvas-border bg-gradient-to-br from-emerald-950/50 to-slate-900/60 p-5 shadow-none sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-accent/80">Result</h2>

        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-canvas-border bg-slate-950/50 px-4 py-5 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-canvas-subtle">
              {amountNum > 0 ? `${amountNum} ${from} equals` : 'Converted amount'}
            </p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums text-canvas-accent sm:text-4xl">
              {result ? formatAmount(result.converted, to) : '—'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-canvas-subtle">Rate used</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-canvas-text">
              {result ? `1 ${from} = ${formatRate(result.rate)} ${to}` : '—'}
            </p>
            <p className="mt-1 text-xs tabular-nums text-canvas-subtle">
              {result ? `1 ${to} = ${formatRate(result.inverseRate)} ${from}` : '—'}
            </p>
          </div>

          {usdRates?.INR && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-4">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-canvas-subtle">
                Popular rates (1 unit → INR)
              </p>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {POPULAR_INR_REFS.filter((code) => usdRates[code]).map((code) => {
                  const inInr = usdRates.INR / usdRates[code];
                  return (
                    <li key={code} className="flex justify-between tabular-nums text-canvas-subtle">
                      <span>{code}</span>
                      <span className="font-medium text-canvas-muted">
                        {new Intl.NumberFormat('en-IN', {
                          style: 'currency',
                          currency: 'INR',
                          maximumFractionDigits: 2,
                        }).format(inInr)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
