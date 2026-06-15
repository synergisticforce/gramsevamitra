import { useEffect, useMemo, useRef, useState } from 'react';
import type { Chart } from 'chart.js';
import { destroyChart, gsmTooltipOptions, renderChart } from '../../lib/charts/chartHelper';
import {
  QUICK_TOOLS_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/quickToolsCanvasStorage';
import { formatInr } from '../../lib/finance/formatInr';
import {
  BUDGET_CATEGORY_LABELS,
  createBudgetLineId,
  lineItemTotal,
  summarizeBudget,
  type BudgetLineCategory,
  type BudgetLineItem,
} from '../../lib/quickTools/lineItemBudgetEngine';

const DEFAULT_ITEMS: BudgetLineItem[] = [
  { id: createBudgetLineId(), name: 'Cement (bags)', quantity: 50, unitCost: 380, category: 'materials' },
  { id: createBudgetLineId(), name: 'Sand (cft)', quantity: 200, unitCost: 45, category: 'materials' },
  { id: createBudgetLineId(), name: 'Bricks (1000 nos)', quantity: 5, unitCost: 6500, category: 'materials' },
  { id: createBudgetLineId(), name: 'Steel (kg)', quantity: 500, unitCost: 62, category: 'materials' },
  { id: createBudgetLineId(), name: 'Mason labor (days)', quantity: 20, unitCost: 800, category: 'labor' },
  { id: createBudgetLineId(), name: 'Helper labor (days)', quantity: 15, unitCost: 500, category: 'labor' },
];

const LIGHT_LEGEND = {
  labels: { color: '#64748b', boxWidth: 12, padding: 12, font: { size: 11 } },
};

export default function QuickConstructionEstimator() {
  const initial = useMemo(
    () => loadPersistedJson<{ items: BudgetLineItem[] }>(QUICK_TOOLS_STORAGE_KEYS.construction, { items: DEFAULT_ITEMS }),
    []
  );
  const [items, setItems] = useState<BudgetLineItem[]>(initial.items);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chart = useRef<Chart | null>(null);

  const summary = useMemo(() => summarizeBudget(items), [items]);

  useEffect(() => {
    savePersistedJson(QUICK_TOOLS_STORAGE_KEYS.construction, { items });
  }, [items]);

  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas) return;

    void (async () => {
      chart.current = await renderChart(canvas, chart.current, {
        type: 'doughnut',
        data: {
          labels: ['Materials', 'Labor', 'Other'],
          datasets: [
            {
              data: [summary.materials, summary.labor, summary.other],
              backgroundColor: ['#7c3aed', '#059669', '#94a3b8'],
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
  }, [summary]);

  const inputClass =
    'w-full rounded-xl border border-canvas-border px-3 py-2 text-sm outline-none ring-violet-500/30 focus:border-violet-400 focus:ring-2 tabular-nums';

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: createBudgetLineId(), name: 'New item', quantity: 1, unitCost: 0, category: 'materials' },
    ]);
  };

  const updateItem = (index: number, patch: Partial<BudgetLineItem>) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-canvas-border bg-canvas-accent-soft/80 p-5">
        <p className="text-xs font-semibold uppercase text-canvas-accent">Estimated project cost</p>
        <p className="mt-1 text-3xl font-bold text-violet-900">{formatInr(summary.total)}</p>
        <p className="mt-1 text-sm text-violet-800">
          Materials {formatInr(summary.materials)} · Labor {formatInr(summary.labor)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-56 rounded-2xl border border-canvas-border bg-canvas-surface p-4">
          <p className="mb-2 text-xs font-semibold uppercase text-canvas-subtle">Cost breakdown</p>
          <div className="h-44">
            <canvas ref={chartRef} />
          </div>
        </div>
        <div className="rounded-2xl border border-canvas-border bg-canvas-surface p-4">
          <p className="text-xs font-semibold uppercase text-canvas-subtle">Summary</p>
          <ul className="mt-3 space-y-2 text-sm">
            {(['materials', 'labor', 'other'] as BudgetLineCategory[]).map((cat) => (
              <li key={cat} className="flex justify-between">
                <span className="text-canvas-muted">{BUDGET_CATEGORY_LABELS[cat]}</span>
                <span className="font-semibold text-canvas-text">{formatInr(summary[cat])}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <section className="rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-subtle">Line items</h2>
          <button type="button" onClick={addItem} className="rounded-lg bg-canvas-accent-muted px-3 py-1.5 text-xs font-semibold text-canvas-text">
            + Add item
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {items.map((item, index) => (
            <div key={item.id} className="grid grid-cols-2 gap-2 rounded-xl border border-slate-100 bg-canvas-elevated p-3 sm:grid-cols-6">
              <input value={item.name} onChange={(e) => updateItem(index, { name: e.target.value })} className={`${inputClass} sm:col-span-2`} placeholder="Item" />
              <input type="number" min={0} step="any" value={item.quantity} onChange={(e) => updateItem(index, { quantity: Number(e.target.value) || 0 })} className={inputClass} placeholder="Qty" />
              <input type="number" min={0} value={item.unitCost} onChange={(e) => updateItem(index, { unitCost: Number(e.target.value) || 0 })} className={inputClass} placeholder="Unit ₹" />
              <select value={item.category} onChange={(e) => updateItem(index, { category: e.target.value as BudgetLineCategory })} className={inputClass}>
                <option value="materials">Materials</option>
                <option value="labor">Labor</option>
                <option value="other">Other</option>
              </select>
              <div className="flex items-center justify-between gap-2 sm:col-span-2">
                <span className="text-sm font-semibold text-violet-800">{formatInr(lineItemTotal(item))}</span>
                <button type="button" onClick={() => removeItem(index)} className="text-xs font-semibold text-rose-600">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
