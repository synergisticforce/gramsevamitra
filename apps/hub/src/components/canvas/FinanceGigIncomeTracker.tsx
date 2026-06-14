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
  createGigEntryId,
  DEFAULT_GIG_ENTRIES,
  gigByCategory,
  monthlyGigTotals,
  totalGigIncome,
  type GigIncomeEntry,
} from '../../lib/finance/gigIncomeEngine';

const LIGHT_LEGEND = {
  labels: { color: '#64748b', boxWidth: 12, padding: 12, font: { size: 11 } },
};

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

export default function FinanceGigIncomeTracker() {
  const initial = useMemo(
    () => loadPersistedJson<{ entries: GigIncomeEntry[] }>(FINANCE_STORAGE_KEYS.gig, { entries: DEFAULT_GIG_ENTRIES }),
    []
  );
  const [entries, setEntries] = useState<GigIncomeEntry[]>(initial.entries);

  const lineRef = useRef<HTMLCanvasElement>(null);
  const doughnutRef = useRef<HTMLCanvasElement>(null);
  const lineChart = useRef<Chart | null>(null);
  const doughnutChart = useRef<Chart | null>(null);

  const monthly = useMemo(() => monthlyGigTotals(entries), [entries]);
  const byCategory = useMemo(() => gigByCategory(entries), [entries]);
  const total = useMemo(() => totalGigIncome(entries), [entries]);

  useEffect(() => {
    savePersistedJson(FINANCE_STORAGE_KEYS.gig, { entries });
  }, [entries]);

  useEffect(() => {
    const lineCanvas = lineRef.current;
    const doughnutCanvas = doughnutRef.current;
    if (!lineCanvas || !doughnutCanvas) return;

    void (async () => {
      lineChart.current = await renderChart(lineCanvas, lineChart.current, {
        type: 'line',
        data: {
          labels: monthly.map((m) => formatMonthLabel(m.month)),
          datasets: [
            {
              label: 'Monthly income',
              data: monthly.map((m) => m.total),
              borderColor: '#059669',
              backgroundColor: 'rgba(5, 150, 105, 0.15)',
              fill: true,
              tension: 0.3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: gsmTooltipOptions((v) => formatInr(v)),
          },
          scales: {
            y: { ticks: { callback: (v) => formatInr(Number(v)) } },
          },
        },
      });

      doughnutChart.current = await renderChart(doughnutCanvas, doughnutChart.current, {
        type: 'doughnut',
        data: {
          labels: byCategory.map((c) => c.category),
          datasets: [
            {
              data: byCategory.map((c) => c.total),
              backgroundColor: ['#059669', '#0284c7', '#d97706', '#7c3aed', '#db2777', '#64748b'],
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
      lineChart.current = destroyChart(lineChart.current);
      doughnutChart.current = destroyChart(doughnutChart.current);
    };
  }, [monthly, byCategory]);

  const inputClass =
    'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-400 focus:ring-2';

  const addEntry = () => {
    setEntries((prev) => [
      ...prev,
      {
        id: createGigEntryId(),
        date: new Date().toISOString().slice(0, 10),
        amount: 0,
        client: '',
        category: 'Other',
      },
    ]);
  };

  const updateEntry = (index: number, patch: Partial<GigIncomeEntry>) => {
    setEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const removeEntry = (index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5">
        <p className="text-xs font-semibold uppercase text-emerald-700">Total gig income</p>
        <p className="mt-1 text-3xl font-bold text-emerald-900">{formatInr(total)}</p>
        <p className="mt-1 text-sm text-emerald-800">{entries.length} entries tracked</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-56 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Monthly income</p>
          <div className="h-44">
            <canvas ref={lineRef} />
          </div>
        </div>
        <div className="h-56 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-xs font-semibold uppercase text-slate-500">By category</p>
          <div className="h-44">
            <canvas ref={doughnutRef} />
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Income entries</h2>
          <button type="button" onClick={addEntry} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">
            + Add entry
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {entries.map((entry, index) => (
            <div key={entry.id} className="grid grid-cols-2 gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 sm:grid-cols-5">
              <input type="date" value={entry.date} onChange={(e) => updateEntry(index, { date: e.target.value })} className={inputClass} />
              <input type="number" min={0} value={entry.amount} onChange={(e) => updateEntry(index, { amount: Number(e.target.value) || 0 })} placeholder="Amount" className={inputClass} />
              <input value={entry.client} onChange={(e) => updateEntry(index, { client: e.target.value })} placeholder="Client" className={inputClass} />
              <input value={entry.category} onChange={(e) => updateEntry(index, { category: e.target.value })} placeholder="Category" className={inputClass} />
              <button type="button" onClick={() => removeEntry(index)} className="rounded-xl border border-rose-200 text-xs font-semibold text-rose-600 hover:bg-rose-50">
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
