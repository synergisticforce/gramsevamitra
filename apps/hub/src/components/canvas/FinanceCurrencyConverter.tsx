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
import { formatCurrencyLabel } from '../../lib/finance/currencyDisplay';
import ToolProcessingWait from './ToolProcessingWait';

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
    'w-full rounded-xl border border-canvas-border bg-canvas-elevated px-3 py-2.5 text-sm text-slate-200 outline-none ring-canvas-accent/30 focus:border-canvas-accent focus:ring-2 tabular-nums';

  const selectClass = `${inputClass} mt-1.5 max-w-full truncate sm:whitespace-normal sm:text-wrap`;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-subtle">Convert</h2>
        {loading && <ToolProcessingWait label="Loading live exchange rates…" className="mt-4" />}
        {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
        {!loading && meta && <p className="mt-2 text-xs font-medium leading-relaxed text-slate-300">{meta}</p>}
        <div className="mt-4 space-y-4">
          <label className="block text-sm font-medium text-canvas-muted">
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block min-w-0 text-sm font-medium text-canvas-muted">
              From
              <select
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                disabled={!rates}
                className={selectClass}
              >
                {codes.map((code) => (
                  <option key={code} value={code}>
                    {formatCurrencyLabel(code)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-0 text-sm font-medium text-canvas-muted">
              To
              <select
                value={to}
                onChange={(e) => setTo(e.target.value)}
                disabled={!rates}
                className={selectClass}
              >
                {codes.map((code) => (
                  <option key={code} value={code}>
                    {formatCurrencyLabel(code)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="button" onClick={swap} disabled={!rates} className="w-full rounded-xl border border-canvas-border py-2 text-sm font-semibold text-canvas-muted hover:bg-canvas-elevated">
            ⇅ Swap currencies
          </button>
        </div>
      </section>
      <section className="rounded-2xl border border-canvas-border bg-canvas-accent-soft/80 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-accent">Result</h2>
        <p className="mt-3 break-words text-2xl font-bold tabular-nums text-slate-100 sm:text-3xl">
          {result ? formatFxAmount(result.converted, to) : '—'}
        </p>
        {result && (
          <p className="mt-1.5 break-words text-sm font-medium leading-relaxed text-slate-200">
            {formatCurrencyLabel(to)}
          </p>
        )}
        {result && (
          <p className="mt-3 break-words text-sm leading-relaxed text-slate-200">
            1 {formatCurrencyLabel(from)} = {formatFxRate(result.rate)}{' '}
            {formatCurrencyLabel(to)}
          </p>
        )}
        {rates?.INR && (
          <ul className="mt-4 space-y-2 text-xs text-slate-300">
            {POPULAR_INR_REFS.filter((c) => rates[c]).map((code) => (
              <li key={code} className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                <span className="break-words leading-relaxed text-slate-300">
                  {formatCurrencyLabel(code)} → {formatCurrencyLabel('INR')}
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-slate-100">
                  {formatFxAmount(rates.INR / rates[code], 'INR')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
