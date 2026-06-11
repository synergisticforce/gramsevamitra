import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'gsm-tools:multi-currency';
const RATES_CACHE_KEY = 'gsm-tools:fx-rates-cache';
const FRANKFURTER_LATEST = 'https://api.frankfurter.app/latest';
const FRANKFURTER_CURRENCIES = 'https://api.frankfurter.app/currencies';
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

const DEFAULTS = { amount: 10000, from: 'INR', to: 'USD' };

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

function formatAmount(value: number, currency: string): string {
  if (!Number.isFinite(value)) return '—';
  const zeroDec = ['JPY', 'KRW', 'IDR', 'VND'].includes(currency);
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: zeroDec ? 0 : 2,
    maximumFractionDigits: zeroDec ? 0 : 4,
  }).format(value);
  return `${CURRENCY_SYMBOLS[currency] ?? `${currency} `}${formatted}`;
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

  const res = await fetch(FRANKFURTER_LATEST, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Rates unavailable (${res.status})`);
  const data = (await res.json()) as { base: string; rates: Record<string, number> };
  const rates = { [data.base]: 1, ...data.rates };
  writeCache(rates, data.base);
  return { rates, updatedAt: new Date() };
}

async function fetchCurrencyList(): Promise<string[]> {
  const res = await fetch(FRANKFURTER_CURRENCIES, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error('Currency list unavailable');
  const data = (await res.json()) as Record<string, string>;
  return Object.keys(data).sort();
}

export default function MultiCurrencyConverterTool() {
  const [amount, setAmount] = useState(String(DEFAULTS.amount));
  const [from, setFrom] = useState(DEFAULTS.from);
  const [to, setTo] = useState(DEFAULTS.to);
  const [eurRates, setEurRates] = useState<Record<string, number> | null>(null);
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
        const [{ rates, updatedAt }, currencyCodes] = await Promise.all([
          fetchLiveRates(),
          fetchCurrencyList(),
        ]);
        if (cancelled) return;
        setEurRates(rates);
        setCodes([...new Set([...currencyCodes, ...Object.keys(rates)])].sort());
        setRatesUpdatedAt(
          updatedAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
        );
      } catch {
        if (!cancelled) {
          setRatesError('Unable to load live exchange rates. Check your connection and try again.');
          setEurRates(null);
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
    if (!eurRates || amountNum <= 0) return null;
    const fromRate = eurRates[from];
    const toRate = eurRates[to];
    if (!fromRate || !toRate) return null;
    const inEur = amountNum / fromRate;
    const converted = inEur * toRate;
    const rate = toRate / fromRate;
    const inverseRate = fromRate / toRate;
    return { converted, rate, inverseRate };
  }, [eurRates, amountNum, from, to]);

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

  const inrRate = eurRates?.INR;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Convert</h2>

        {loadingRates && (
          <p className="mt-3 text-sm text-emerald-300" role="status">
            Loading live rates…
          </p>
        )}
        {ratesError && (
          <p className="mt-3 rounded-lg border border-rose-800/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-300" role="alert">
            {ratesError}
          </p>
        )}
        {!loadingRates && !ratesError && ratesUpdatedAt && (
          <p className="mt-3 text-xs text-slate-400" role="status">
            Rates updated: {ratesUpdatedAt} — Sourced from public markets.
          </p>
        )}

        <div className="mt-5 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">Amount</span>
            <input
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={amount}
              onChange={(e) => handleAmount(e.target.value)}
              disabled={!eurRates}
              className="input-field w-full tabular-nums"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="min-w-0">
              <span className="mb-2 block text-sm font-medium text-slate-300">From</span>
              <select
                value={from}
                onChange={(e) => handleFrom(e.target.value)}
                disabled={!eurRates}
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
              <span className="mb-2 block text-sm font-medium text-slate-300">To</span>
              <select
                value={to}
                onChange={(e) => handleTo(e.target.value)}
                disabled={!eurRates}
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

          <button type="button" onClick={swap} disabled={!eurRates} className="btn-secondary w-full text-sm">
            ⇅ Swap currencies
          </button>
        </div>

        <button type="button" onClick={reset} className="btn-secondary mt-6 w-full text-sm">
          Reset
        </button>
      </section>

      <section className="rounded-2xl border border-emerald-900/40 bg-gradient-to-br from-emerald-950/50 to-slate-900/60 p-5 shadow-xl sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-400/80">Result</h2>

        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-emerald-800/40 bg-slate-950/50 px-4 py-5 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              {amountNum > 0 ? `${amountNum} ${from} equals` : 'Converted amount'}
            </p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums text-emerald-400 sm:text-4xl">
              {result ? formatAmount(result.converted, to) : '—'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Rate used</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-white">
              {result ? `1 ${from} = ${formatRate(result.rate)} ${to}` : '—'}
            </p>
            <p className="mt-1 text-xs tabular-nums text-slate-500">
              {result ? `1 ${to} = ${formatRate(result.inverseRate)} ${from}` : '—'}
            </p>
          </div>

          {inrRate && eurRates && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-4">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                Popular rates (1 unit → INR)
              </p>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {POPULAR_INR_REFS.filter((code) => eurRates[code]).map((code) => {
                  const inInr = eurRates.INR / eurRates[code];
                  return (
                    <li key={code} className="flex justify-between tabular-nums text-slate-400">
                      <span>{code}</span>
                      <span className="font-medium text-slate-300">₹{inInr.toFixed(2)}</span>
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
