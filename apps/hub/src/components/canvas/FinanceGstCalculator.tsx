import { useEffect, useMemo, useRef, useState } from 'react';
import type { Chart, ChartConfiguration } from 'chart.js';
import { destroyChart, gsmTooltipOptions, renderChart } from '../../lib/charts/chartHelper';
import {
  FINANCE_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/financeCanvasStorage';
import { formatInr } from '../../lib/finance/formatInr';
import {
  calculateGst,
  GST_SLABS,
  type GstMode,
  type GstSupplyType,
} from '../../lib/finance/gstEngine';

interface GstFormState {
  amount: number;
  rate: number;
  mode: GstMode;
  supplyType: GstSupplyType;
}

const DEFAULTS: GstFormState = {
  amount: 10_000,
  rate: 18,
  mode: 'exclusive',
  supplyType: 'intrastate',
};

const LIGHT_LEGEND = {
  labels: { color: '#64748b', boxWidth: 12, padding: 12, font: { size: 11 } },
};

function pillClass(active: boolean): string {
  return `rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
    active
      ? 'border-canvas-accent bg-canvas-accent-soft text-canvas-accent'
      : 'border-canvas-border bg-canvas-surface text-canvas-muted hover:border-emerald-300'
  }`;
}

export default function FinanceGstCalculator() {
  const initial = useMemo(
    () => loadPersistedJson<GstFormState>(FINANCE_STORAGE_KEYS.gst, DEFAULTS),
    []
  );
  const [amount, setAmount] = useState(initial.amount);
  const [rate, setRate] = useState(initial.rate);
  const [mode, setMode] = useState<GstMode>(initial.mode);
  const [supplyType, setSupplyType] = useState<GstSupplyType>(initial.supplyType);

  const chartRef = useRef<HTMLCanvasElement>(null);
  const chart = useRef<Chart | null>(null);

  const result = useMemo(
    () => calculateGst(amount, rate, mode, supplyType),
    [amount, rate, mode, supplyType]
  );

  useEffect(() => {
    savePersistedJson(FINANCE_STORAGE_KEYS.gst, { amount, rate, mode, supplyType });
  }, [amount, rate, mode, supplyType]);

  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas) return;

    if (!result) {
      chart.current = destroyChart(chart.current);
      return;
    }

    const labels =
      supplyType === 'interstate'
        ? ['Net (taxable)', 'IGST']
        : ['Net (taxable)', 'CGST', 'SGST'];

    const data =
      supplyType === 'interstate'
        ? [Math.round(result.net), Math.round(result.igst)]
        : [Math.round(result.net), Math.round(result.cgst), Math.round(result.sgst)];

    const colors =
      supplyType === 'interstate'
        ? ['#059669', '#d97706']
        : ['#059669', '#0284c7', '#d97706'];

    void (async () => {
      const doughnutConfig: ChartConfiguration<'doughnut'> = {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{ data, backgroundColor: colors, borderWidth: 0 }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '58%',
          plugins: {
            legend: { ...LIGHT_LEGEND, position: 'bottom' },
            tooltip: gsmTooltipOptions((v) => formatInr(v, 2)),
          },
        },
      };
      chart.current = await renderChart(canvas, chart.current, doughnutConfig);
    })();

    return () => {
      chart.current = destroyChart(chart.current);
    };
  }, [result, supplyType]);

  const inputClass =
    'w-full rounded-xl border border-canvas-border px-3 py-2.5 text-sm text-canvas-text outline-none ring-canvas-accent/50/30 focus:border-canvas-accent focus:ring-2 tabular-nums';

  const halfRate = rate / 2;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-subtle">Amount &amp; slab</h2>
        <div className="mt-4 space-y-5">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-canvas-muted">
              {mode === 'exclusive' ? 'Net price (pre-tax) ₹' : 'Gross price (inclusive) ₹'}
            </span>
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
              className={inputClass}
            />
          </label>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-canvas-muted">GST rate</legend>
            <div className="flex flex-wrap gap-2">
              {GST_SLABS.map((slab) => (
                <button
                  key={slab}
                  type="button"
                  onClick={() => setRate(slab)}
                  className={pillClass(rate === slab)}
                >
                  {slab}%
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-canvas-muted">Mode</legend>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setMode('exclusive')} className={pillClass(mode === 'exclusive')}>
                Tax exclusive
              </button>
              <button type="button" onClick={() => setMode('inclusive')} className={pillClass(mode === 'inclusive')}>
                Tax inclusive
              </button>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-canvas-muted">Supply type</legend>
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
        </div>
      </section>

      <section className="rounded-2xl border border-canvas-border bg-gradient-to-br from-canvas-accent-soft/40 to-canvas-surface p-5 shadow-none">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-accent">GST breakdown</h2>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-canvas-subtle">Net (taxable value)</dt>
            <dd className="font-semibold tabular-nums text-canvas-text">
              {result ? formatInr(result.net, 2) : '₹0.00'}
            </dd>
          </div>
          {supplyType === 'intrastate' ? (
            <>
              <div className="flex justify-between gap-3">
                <dt className="text-canvas-subtle">CGST ({halfRate}%)</dt>
                <dd className="font-semibold tabular-nums text-sky-700">
                  {result ? formatInr(result.cgst, 2) : '₹0.00'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-canvas-subtle">SGST ({halfRate}%)</dt>
                <dd className="font-semibold tabular-nums text-canvas-muted">
                  {result ? formatInr(result.sgst, 2) : '₹0.00'}
                </dd>
              </div>
            </>
          ) : (
            <div className="flex justify-between gap-3">
              <dt className="text-canvas-subtle">IGST ({rate}%)</dt>
              <dd className="font-semibold tabular-nums text-canvas-muted">
                {result ? formatInr(result.igst, 2) : '₹0.00'}
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-3 border-t border-emerald-100 pt-2">
            <dt className="font-medium text-canvas-muted">Total GST</dt>
            <dd className="font-semibold tabular-nums text-amber-800">
              {result ? formatInr(result.gstTotal, 2) : '₹0.00'}
            </dd>
          </div>
          <div className="flex justify-between gap-3 rounded-lg border border-canvas-border bg-canvas-surface px-3 py-2">
            <dt className="font-medium text-canvas-accent">Gross valuation</dt>
            <dd className="text-lg font-bold tabular-nums text-canvas-accent">
              {result ? formatInr(result.gross, 2) : '₹0.00'}
            </dd>
          </div>
        </dl>

        <div className="relative mt-5 h-52 rounded-xl border border-slate-100 bg-canvas-surface p-3">
          <canvas ref={chartRef} aria-label="Net vs GST components" />
        </div>
      </section>
    </div>
  );
}
