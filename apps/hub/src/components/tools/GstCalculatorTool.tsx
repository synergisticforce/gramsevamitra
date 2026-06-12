import { useEffect, useMemo, useState } from 'react';
import { formatInr } from '../../lib/finance/formatInr';
import {
  calculateGst,
  GST_SLABS,
  type GstMode,
  type GstSupplyType,
} from '../../lib/finance/gstEngine';

const STORAGE_KEY = 'gsm-tools:gst-calculator';

interface SavedState {
  amount: number;
  rate: number;
  customRate: boolean;
  mode: GstMode;
  supplyType: GstSupplyType;
}

const DEFAULTS: SavedState = {
  amount: 1000,
  rate: 18,
  customRate: false,
  mode: 'exclusive',
  supplyType: 'intrastate',
};

function loadState(): SavedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<SavedState>;
    return {
      amount: typeof parsed.amount === 'number' ? parsed.amount : DEFAULTS.amount,
      rate: typeof parsed.rate === 'number' ? parsed.rate : DEFAULTS.rate,
      customRate: Boolean(parsed.customRate),
      mode: parsed.mode === 'inclusive' ? 'inclusive' : 'exclusive',
      supplyType: parsed.supplyType === 'interstate' ? 'interstate' : 'intrastate',
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function pillClass(active: boolean): string {
  return `inline-flex cursor-pointer items-center rounded-full border px-4 py-2 text-sm font-semibold transition ${
    active
      ? 'border-emerald-500 bg-emerald-950/50 text-emerald-300 ring-2 ring-emerald-400/40'
      : 'border-slate-700 bg-slate-950/60 text-slate-300 hover:border-emerald-600 hover:text-white'
  }`;
}

export default function GstCalculatorTool() {
  const initial = useMemo(() => loadState(), []);
  const [amount, setAmount] = useState(initial.amount);
  const [rate, setRate] = useState(initial.rate);
  const [customRate, setCustomRate] = useState(initial.customRate);
  const [mode, setMode] = useState<GstMode>(initial.mode);
  const [supplyType, setSupplyType] = useState<GstSupplyType>(initial.supplyType);

  const result = useMemo(
    () => calculateGst(amount, rate, mode, supplyType),
    [amount, rate, mode, supplyType],
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ amount, rate, customRate, mode, supplyType }));
    } catch {
      /* ignore */
    }
  }, [amount, rate, customRate, mode, supplyType]);

  const halfRate = rate / 2;
  const modeLabel = mode === 'exclusive' ? 'Tax exclusive' : 'Tax inclusive';
  const supplyLabel = supplyType === 'interstate' ? 'Inter-state (IGST)' : 'Intra-state (CGST + SGST)';

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Amount &amp; tax slab</h2>
        <div className="mt-5 space-y-5">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-300">
              {mode === 'exclusive' ? 'Net price (pre-tax) ₹' : 'Gross price (tax inclusive) ₹'}
            </span>
            <input
              type="number"
              min={0}
              step={1}
              value={amount}
              onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
              className="input-field w-full tabular-nums"
            />
          </label>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-300">GST rate</legend>
            <div className="flex flex-wrap gap-2">
              {GST_SLABS.map((slab) => (
                <button
                  key={slab}
                  type="button"
                  onClick={() => {
                    setRate(slab);
                    setCustomRate(false);
                  }}
                  className={pillClass(!customRate && rate === slab)}
                >
                  {slab}%
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCustomRate(true)}
                className={pillClass(customRate)}
              >
                Custom
              </button>
            </div>
            {customRate && (
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={rate}
                onChange={(e) => setRate(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                className="input-field mt-3 w-full tabular-nums"
                placeholder="Custom rate %"
              />
            )}
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-300">Calculation mode</legend>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMode('exclusive')}
                className={pillClass(mode === 'exclusive')}
              >
                Tax exclusive
              </button>
              <button
                type="button"
                onClick={() => setMode('inclusive')}
                className={pillClass(mode === 'inclusive')}
              >
                Tax inclusive
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {mode === 'exclusive'
                ? 'Enter net price; GST is added to compute gross valuation.'
                : 'Enter gross price; GST is extracted to reveal net price.'}
            </p>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-300">Supply type</legend>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSupplyType('intrastate')}
                className={pillClass(supplyType === 'intrastate')}
              >
                CGST + SGST
              </button>
              <button
                type="button"
                onClick={() => setSupplyType('interstate')}
                className={pillClass(supplyType === 'interstate')}
              >
                IGST
              </button>
            </div>
          </fieldset>

          <button
            type="button"
            onClick={() => {
              setAmount(DEFAULTS.amount);
              setRate(DEFAULTS.rate);
              setCustomRate(false);
              setMode(DEFAULTS.mode);
              setSupplyType(DEFAULTS.supplyType);
            }}
            className="btn-secondary w-full text-sm"
          >
            Reset
          </button>
        </div>
      </section>

      <section
        className="rounded-2xl border border-emerald-900/40 bg-gradient-to-br from-emerald-950/50 to-slate-900/60 p-5 shadow-xl sm:p-6"
        aria-live="polite"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-400/80">Fiscal invoice breakdown</h2>

        <div className="mt-5 rounded-xl border border-dashed border-slate-700 bg-slate-950/50 p-4 sm:p-5">
          <div className="mb-4 border-b border-slate-800 pb-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">GST ledger</p>
            <p className="mt-1 text-sm font-medium text-emerald-400">
              {rate}% GST · {modeLabel} · {supplyLabel}
            </p>
          </div>

          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-400">Net price (taxable value)</dt>
              <dd className="font-semibold tabular-nums text-white">
                {result ? formatInr(result.net, 2) : '₹0.00'}
              </dd>
            </div>

            {supplyType === 'intrastate' ? (
              <>
                <div className="flex items-center justify-between gap-3 border-t border-slate-800/80 pt-3">
                  <dt className="text-slate-400">CGST ({halfRate}%)</dt>
                  <dd className="font-semibold tabular-nums text-amber-300">
                    {result ? formatInr(result.cgst, 2) : '₹0.00'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-400">SGST ({halfRate}%)</dt>
                  <dd className="font-semibold tabular-nums text-amber-300">
                    {result ? formatInr(result.sgst, 2) : '₹0.00'}
                  </dd>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between gap-3 border-t border-slate-800/80 pt-3">
                <dt className="text-slate-400">IGST ({rate}%)</dt>
                <dd className="font-semibold tabular-nums text-amber-300">
                  {result ? formatInr(result.igst, 2) : '₹0.00'}
                </dd>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-slate-800/80 pt-3">
              <dt className="text-slate-400">Total GST</dt>
              <dd className="font-semibold tabular-nums text-amber-400">
                {result ? formatInr(result.gstTotal, 2) : '₹0.00'}
              </dd>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-800/40 bg-emerald-950/30 px-3 py-3">
              <dt className="font-medium text-emerald-200">Final gross valuation</dt>
              <dd className="text-lg font-bold tabular-nums text-emerald-400">
                {result ? formatInr(result.gross, 2) : '₹0.00'}
              </dd>
            </div>
          </dl>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          {result
            ? mode === 'exclusive'
              ? `Net ${formatInr(result.net, 2)} + GST ${formatInr(result.gstTotal, 2)} = Gross ${formatInr(result.gross, 2)}`
              : `Gross ${formatInr(result.gross, 2)} includes GST ${formatInr(result.gstTotal, 2)}; net taxable value ${formatInr(result.net, 2)}`
            : 'Enter an amount to see the itemized GST breakdown.'}
        </p>
      </section>
    </div>
  );
}
