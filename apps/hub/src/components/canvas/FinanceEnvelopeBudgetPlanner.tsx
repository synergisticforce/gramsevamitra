import { useEffect, useMemo, useRef, useState } from 'react';
import type { Chart } from 'chart.js';
import { destroyChart, gsmTooltipOptions, renderChart } from '../../lib/charts/chartHelper';
import {
  FINANCE_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/financeCanvasStorage';
import { formatInr } from '../../lib/finance/formatInr';
import {
  createEnvelopeId,
  DEFAULT_ENVELOPES,
  ENVELOPE_COLORS,
  summarizeEnvelopes,
  type EnvelopeCategory,
} from '../../lib/finance/envelopeBudgetEngine';

const LIGHT_LEGEND = {
  labels: { color: '#64748b', boxWidth: 12, padding: 12, font: { size: 11 } },
};

export default function FinanceEnvelopeBudgetPlanner() {
  const initial = useMemo(
    () => loadPersistedJson<{ envelopes: EnvelopeCategory[] }>(FINANCE_STORAGE_KEYS.envelope, { envelopes: DEFAULT_ENVELOPES }),
    []
  );
  const [envelopes, setEnvelopes] = useState<EnvelopeCategory[]>(initial.envelopes);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chart = useRef<Chart | null>(null);

  const summary = useMemo(() => summarizeEnvelopes(envelopes), [envelopes]);

  useEffect(() => {
    savePersistedJson(FINANCE_STORAGE_KEYS.envelope, { envelopes });
  }, [envelopes]);

  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas) return;

    void (async () => {
      chart.current = await renderChart(canvas, chart.current, {
        type: 'bar',
        data: {
          labels: envelopes.map((e) => e.name),
          datasets: [
            {
              label: 'Budget',
              data: envelopes.map((e) => e.budget),
              backgroundColor: '#cbd5e1',
              borderRadius: 4,
            },
            {
              label: 'Spent',
              data: envelopes.map((e) => e.spent),
              backgroundColor: envelopes.map((e) => (e.spent > e.budget ? '#e11d48' : '#059669')),
              borderRadius: 4,
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
          scales: {
            y: { ticks: { callback: (v) => formatInr(Number(v)) } },
          },
        },
      });
    })();

    return () => {
      chart.current = destroyChart(chart.current);
    };
  }, [envelopes]);

  const inputClass =
    'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-400 focus:ring-2 tabular-nums';

  const updateEnvelope = (index: number, patch: Partial<EnvelopeCategory>) => {
    setEnvelopes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const addEnvelope = () => {
    const color = ENVELOPE_COLORS[envelopes.length % ENVELOPE_COLORS.length];
    setEnvelopes((prev) => [
      ...prev,
      { id: createEnvelopeId(), name: 'New envelope', budget: 0, spent: 0, color },
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Total budget</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{formatInr(summary.totalBudget)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Total spent</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{formatInr(summary.totalSpent)}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
          <p className="text-xs font-semibold uppercase text-emerald-700">Remaining</p>
          <p className={`mt-1 text-xl font-bold ${summary.remaining >= 0 ? 'text-emerald-900' : 'text-rose-700'}`}>
            {formatInr(summary.remaining)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Over budget</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{summary.overBudgetCount}</p>
        </div>
      </div>

      <div className="h-64 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Budget vs. actual</p>
        <div className="h-52">
          <canvas ref={chartRef} />
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Envelopes</h2>
          <button type="button" onClick={addEnvelope} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">
            + Add envelope
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {envelopes.map((env, index) => {
            const pct = env.budget > 0 ? Math.min(100, (env.spent / env.budget) * 100) : 0;
            const over = env.spent > env.budget;
            return (
              <div key={env.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="grid gap-2 sm:grid-cols-3">
                  <input value={env.name} onChange={(e) => updateEnvelope(index, { name: e.target.value })} className={inputClass} />
                  <label className="text-xs text-slate-500">
                    Budget
                    <input type="number" min={0} value={env.budget} onChange={(e) => updateEnvelope(index, { budget: Number(e.target.value) || 0 })} className={`${inputClass} mt-1`} />
                  </label>
                  <label className="text-xs text-slate-500">
                    Spent
                    <input type="number" min={0} value={env.spent} onChange={(e) => updateEnvelope(index, { spent: Number(e.target.value) || 0 })} className={`${inputClass} mt-1`} />
                  </label>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full transition-all ${over ? 'bg-rose-500' : 'bg-emerald-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {formatInr(env.spent)} of {formatInr(env.budget)} ({pct.toFixed(0)}%)
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
