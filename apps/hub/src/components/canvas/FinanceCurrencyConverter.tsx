import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FINANCE_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/financeCanvasStorage';
import {
  convertFxAmount,
  fetchFxRates,
  formatFxAmount,
  formatFxRate,
  POPULAR_INR_REFS,
} from '../../lib/finance/currencyFxEngine';

interface CurrencyFormState {
  amount: number;
  from: string;
  to: string;
}

const DEFAULTS: CurrencyFormState = { amount: 100, from: 'USD', to: 'INR' };

export default function FinanceCurrencyConverter() {
  const initial = useMemo(
    () => loadPersistedJson<CurrencyFormState>(FINANCE_STORAGE_KEYS.currency, DEFAULTS),
    []
  );

  const [amount, setAmount] = useState(initial.amount);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState('');

  useEffect(() => {
    savePersistedJson(FINANCE_STORAGE_KEYS.currency, { amount, from, to });
  }, [amount, from, to]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchFxRates();
        if (cancelled) return;
        setRates(result.rates);
        setCodes(Object.keys(result.rates).sort());
        const label = result.stale ? ' (offline cache)' : result.fromCache ? ' (cached)' : '';
        setMeta(
          `Rates updated ${result.updatedAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}${label}`
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load rates.');
          setRates(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const result = useMemo(() => {
    if (!rates || amount <= 0) return null;
    return convertFxAmount(amount, from, to, rates);
  }, [amount, from, rates, to]);

  const swap = useCallback(() => {
    setFrom(to);
    setTo(from);
  }, [from, to]);

  const inputClass =
    'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none ring-emerald-500/30 focus:border-emerald-400 focus:ring-2 tabular-nums';

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Convert</h2>
        {loading && <p className="mt-2 text-sm text-slate-500">Loading live rates…</p>}
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        {!loading && meta && <p className="mt-2 text-xs text-slate-400">{meta}</p>}
        <div className="mt-4 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Amount
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
              disabled={!rates}
              className={`${inputClass} mt-1.5`}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-slate-700">
              From
              <select value={from} onChange={(e) => setFrom(e.target.value)} disabled={!rates} className={`${inputClass} mt-1.5`}>
                {codes.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              To
              <select value={to} onChange={(e) => setTo(e.target.value)} disabled={!rates} className={`${inputClass} mt-1.5`}>
                {codes.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </label>
          </div>
          <button type="button" onClick={swap} disabled={!rates} className="w-full rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            ⇅ Swap currencies
          </button>
        </div>
      </section>
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-700">Result</h2>
        <p className="mt-3 text-3xl font-bold tabular-nums text-emerald-900">
          {result ? formatFxAmount(result.converted, to) : '—'}
        </p>
        {result && (
          <p className="mt-2 text-sm text-emerald-800">
            1 {from} = {formatFxRate(result.rate)} {to}
          </p>
        )}
        {rates?.INR && (
          <ul className="mt-4 space-y-1 text-xs text-slate-600">
            {POPULAR_INR_REFS.filter((c) => rates[c]).map((code) => (
              <li key={code} className="flex justify-between">
                <span>{code} → INR</span>
                <span className="font-semibold">{formatFxAmount(rates.INR / rates[code], 'INR')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
