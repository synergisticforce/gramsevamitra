import { useEffect, useMemo, useRef, useState } from 'react';
import type { Chart } from 'chart.js';
import { destroyChart, gsmTooltipOptions, renderChart } from '../../lib/charts/chartHelper';
import {
  FINANCE_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/financeCanvasStorage';
import { clamp, formatInr } from '../../lib/finance/formatInr';
import { calculateTipSplit } from '../../lib/finance/tipSplitEngine';

interface TipFormState {
  billAmount: number;
  tipPercent: number;
  numPeople: number;
}

const DEFAULTS: TipFormState = {
  billAmount: 1_200,
  tipPercent: 10,
  numPeople: 4,
};

const LIGHT_LEGEND = {
  labels: { color: '#64748b', boxWidth: 12, padding: 12, font: { size: 11 } },
};

export default function FinanceTipSplitCalculator() {
  const initial = useMemo(
    () => loadPersistedJson<TipFormState>(FINANCE_STORAGE_KEYS.tip, DEFAULTS),
    []
  );

  const [billAmount, setBillAmount] = useState(initial.billAmount);
  const [tipPercent, setTipPercent] = useState(initial.tipPercent);
  const [numPeople, setNumPeople] = useState(initial.numPeople);

  const chartRef = useRef<HTMLCanvasElement>(null);
  const chart = useRef<Chart | null>(null);

  const result = useMemo(
    () => calculateTipSplit(billAmount, tipPercent, numPeople),
    [billAmount, tipPercent, numPeople]
  );

  useEffect(() => {
    savePersistedJson(FINANCE_STORAGE_KEYS.tip, { billAmount, tipPercent, numPeople });
  }, [billAmount, tipPercent, numPeople]);

  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas || !result) {
      chart.current = destroyChart(chart.current);
      return;
    }

    void (async () => {
      chart.current = await renderChart(canvas, chart.current, {
        type: 'doughnut',
        data: {
          labels: ['Bill', 'Tip'],
          datasets: [
            {
              data: [Math.round(result.billAmount), Math.round(result.tipAmount)],
              backgroundColor: ['#64748b', '#059669'],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
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
        <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-subtle">Bill details</h2>
        <div className="mt-4 space-y-4">
          <label className="block text-sm font-medium text-canvas-muted">
            Bill amount (₹)
            <input
              type="number"
              min={1}
              value={billAmount}
              onChange={(e) => setBillAmount(clamp(Number(e.target.value) || 0, 1, 1_000_000))}
              className={`${inputClass} mt-1.5`}
            />
          </label>
          <label className="block text-sm font-medium text-canvas-muted">
            Tip ({tipPercent}%)
            <input
              type="range"
              min={0}
              max={30}
              step={1}
              value={tipPercent}
              onChange={(e) => setTipPercent(Number(e.target.value))}
              className="mt-2 w-full accent-emerald-600"
            />
          </label>
          <label className="block text-sm font-medium text-canvas-muted">
            Split between ({numPeople} people)
            <input
              type="range"
              min={1}
              max={20}
              value={numPeople}
              onChange={(e) => setNumPeople(Number(e.target.value))}
              className="mt-2 w-full accent-emerald-600"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white p-5 shadow-none">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-accent">Per person</h2>
        {result ? (
          <>
            <p className="mt-3 text-3xl font-bold tabular-nums text-canvas-accent">
              {formatInr(Math.round(result.perPerson))}
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-canvas-subtle">Tip amount</dt>
                <dd className="font-semibold">{formatInr(Math.round(result.tipAmount))}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-canvas-subtle">Total with tip</dt>
                <dd className="font-semibold">{formatInr(Math.round(result.totalWithTip))}</dd>
              </div>
            </dl>
          </>
        ) : null}
        <div className="relative mt-5 h-48 rounded-xl border border-slate-100 bg-canvas-surface p-2">
          <canvas ref={chartRef} aria-label="Bill vs tip split" />
        </div>
      </section>
    </div>
  );
}
