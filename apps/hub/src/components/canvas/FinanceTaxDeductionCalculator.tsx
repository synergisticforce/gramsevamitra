import { useEffect, useMemo, useRef, useState } from 'react';
import type { Chart } from 'chart.js';
import { destroyChart, gsmTooltipOptions, renderChart } from '../../lib/charts/chartHelper';
import {
  FINANCE_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/financeCanvasStorage';
import { clamp, formatInr } from '../../lib/finance/formatInr';
import {
  DEDUCTION_CATEGORIES,
  estimateTaxDeductions,
  type TaxRegime,
} from '../../lib/finance/taxDeductionEngine';

interface TaxFormState {
  grossIncome: number;
  regime: TaxRegime;
  deductions: Record<string, number>;
}

const DEFAULTS: TaxFormState = {
  grossIncome: 1_200_000,
  regime: 'new',
  deductions: {
    '80c': 150_000,
    '80d': 25_000,
    '80ccd': 0,
    hra: 0,
    'home-loan': 0,
    other: 0,
  },
};

const LIGHT_LEGEND = {
  labels: { color: '#64748b', boxWidth: 12, padding: 12, font: { size: 11 } },
};

export default function FinanceTaxDeductionCalculator() {
  const initial = useMemo(
    () => loadPersistedJson<TaxFormState>(FINANCE_STORAGE_KEYS.tax, DEFAULTS),
    []
  );

  const [grossIncome, setGrossIncome] = useState(initial.grossIncome);
  const [regime, setRegime] = useState<TaxRegime>(initial.regime);
  const [deductions, setDeductions] = useState(initial.deductions);

  const chartRef = useRef<HTMLCanvasElement>(null);
  const chart = useRef<Chart | null>(null);

  const result = useMemo(
    () => estimateTaxDeductions(grossIncome, deductions, regime),
    [deductions, grossIncome, regime]
  );

  useEffect(() => {
    savePersistedJson(FINANCE_STORAGE_KEYS.tax, { grossIncome, regime, deductions });
  }, [deductions, grossIncome, regime]);

  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas) return;

    void (async () => {
      chart.current = await renderChart(canvas, chart.current, {
        type: 'bar',
        data: {
          labels: ['Without extras', 'With deductions'],
          datasets: [
            {
              label: 'Estimated tax',
              data: [
                Math.round(result.taxWithoutExtras),
                Math.round(result.taxWithExtras),
              ],
              backgroundColor: ['#d97706', '#059669'],
              borderRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { ticks: { callback: (v) => formatInr(Number(v)) } },
          },
          plugins: {
            legend: { ...LIGHT_LEGEND, position: 'bottom' },
            tooltip: gsmTooltipOptions((v) => formatInr(v)),
          },
        },
      });
    })();

    return () => {
      chart.current = destroyChart(chart.current);
    };
  }, [result]);

  const inputClass =
    'w-full rounded-xl border border-canvas-border px-3 py-2.5 text-sm text-canvas-text outline-none ring-canvas-accent/50/30 focus:border-canvas-accent focus:ring-2 tabular-nums';

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-subtle">Income & deductions</h2>
        <label className="mt-4 block text-sm font-medium text-canvas-muted">
          Gross annual income (₹)
          <input
            type="number"
            min={100_000}
            value={grossIncome}
            onChange={(e) => setGrossIncome(clamp(Number(e.target.value) || 0, 100_000, 50_000_000))}
            className={`${inputClass} mt-1.5`}
          />
        </label>

        <div className="mt-4 flex gap-2">
          {(['new', 'old'] as TaxRegime[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRegime(r)}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                regime === r
                  ? 'border-canvas-accent bg-canvas-accent-soft text-canvas-accent'
                  : 'border-canvas-border text-canvas-muted hover:bg-canvas-elevated'
              }`}
            >
              {r === 'new' ? 'New regime' : 'Old regime'}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          {DEDUCTION_CATEGORIES.map((cat) => (
            <label key={cat.id} className="block">
              <span className="text-sm font-medium text-canvas-muted">{cat.label}</span>
              <span className="block text-[11px] text-canvas-subtle">{cat.hint}</span>
              <input
                type="number"
                min={0}
                value={deductions[cat.id] ?? 0}
                onChange={(e) =>
                  setDeductions((prev) => ({
                    ...prev,
                    [cat.id]: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                className={`${inputClass} mt-1`}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white p-5 shadow-none">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-accent">Tax savings</h2>
        <p className="mt-3 text-3xl font-bold tabular-nums text-canvas-accent">
          {formatInr(Math.round(result.estimatedSavings))}
        </p>
        <p className="mt-1 text-sm text-canvas-subtle">Estimated annual tax saved</p>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-canvas-subtle">Tax without extras</dt>
            <dd className="font-semibold">{formatInr(Math.round(result.taxWithoutExtras))}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-canvas-subtle">Tax with deductions</dt>
            <dd className="font-semibold text-canvas-accent">
              {formatInr(Math.round(result.taxWithExtras))}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-canvas-subtle">Total deductions applied</dt>
            <dd className="font-semibold">{formatInr(Math.round(result.totalDeductions))}</dd>
          </div>
        </dl>
        <div className="relative mt-5 h-56 rounded-xl border border-slate-100 bg-canvas-surface p-2">
          <canvas ref={chartRef} aria-label="Tax comparison chart" />
        </div>
        <p className="mt-2 text-center text-xs text-canvas-subtle">
          Simplified Indian income-tax estimate · not professional tax advice
        </p>
      </section>
    </div>
  );
}
