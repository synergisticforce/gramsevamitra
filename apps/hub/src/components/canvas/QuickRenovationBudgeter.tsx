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

export interface RenovationLineItem extends BudgetLineItem {
  room: string;
}

function createRenovationLine(partial: Omit<RenovationLineItem, 'id'>): RenovationLineItem {
  return { id: createBudgetLineId(), ...partial };
}

const DEFAULT_ITEMS: RenovationLineItem[] = [
  createRenovationLine({ room: 'Living room', name: 'Interior paint', quantity: 4, unitCost: 450, category: 'materials' }),
  createRenovationLine({ room: 'Living room', name: 'Painter labor', quantity: 3, unitCost: 1200, category: 'labor' }),
  createRenovationLine({ room: 'Kitchen', name: 'Modular cabinets', quantity: 1, unitCost: 85000, category: 'materials' }),
  createRenovationLine({ room: 'Kitchen', name: 'Plumber labor', quantity: 2, unitCost: 1500, category: 'labor' }),
  createRenovationLine({ room: 'Bedroom', name: 'Vinyl flooring (sq ft)', quantity: 180, unitCost: 95, category: 'materials' }),
  createRenovationLine({ room: 'Bedroom', name: 'Electrician labor', quantity: 1, unitCost: 3500, category: 'labor' }),
];

const LIGHT_LEGEND = {
  labels: { color: '#64748b', boxWidth: 12, padding: 12, font: { size: 11 } },
};

export default function QuickRenovationBudgeter() {
  const initial = useMemo(
    () => loadPersistedJson<{ items: RenovationLineItem[] }>(QUICK_TOOLS_STORAGE_KEYS.renovation, { items: DEFAULT_ITEMS }),
    []
  );
  const [items, setItems] = useState<RenovationLineItem[]>(initial.items);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chart = useRef<Chart | null>(null);

  const summary = useMemo(() => summarizeBudget(items), [items]);

  const byRoom = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      const room = item.room.trim() || 'General';
      map.set(room, (map.get(room) ?? 0) + lineItemTotal(item));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  useEffect(() => {
    savePersistedJson(QUICK_TOOLS_STORAGE_KEYS.renovation, { items });
  }, [items]);

  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas) return;

    void (async () => {
      chart.current = await renderChart(canvas, chart.current, {
        type: 'bar',
        data: {
          labels: ['Materials', 'Labor', 'Other'],
          datasets: [
            {
              label: 'Cost',
              data: [summary.materials, summary.labor, summary.other],
              backgroundColor: ['#7c3aed', '#059669', '#94a3b8'],
              borderRadius: 6,
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
      createRenovationLine({ room: 'Room', name: 'New item', quantity: 1, unitCost: 0, category: 'materials' }),
    ]);
  };

  const updateItem = (index: number, patch: Partial<RenovationLineItem>) => {
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
        <p className="text-xs font-semibold uppercase text-canvas-accent">Renovation budget total</p>
        <p className="mt-1 text-3xl font-bold text-violet-900">{formatInr(summary.total)}</p>
        <p className="mt-1 text-sm text-violet-800">
          {items.length} line items across {byRoom.length} room{byRoom.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-56 rounded-2xl border border-canvas-border bg-canvas-surface p-4">
          <p className="mb-2 text-xs font-semibold uppercase text-canvas-subtle">Materials vs. labor</p>
          <div className="h-44">
            <canvas ref={chartRef} />
          </div>
        </div>
        <div className="rounded-2xl border border-canvas-border bg-canvas-surface p-4">
          <p className="text-xs font-semibold uppercase text-canvas-subtle">By room</p>
          <ul className="mt-3 max-h-44 space-y-2 overflow-y-auto text-sm">
            {byRoom.map(([room, total]) => (
              <li key={room} className="flex justify-between">
                <span className="text-canvas-muted">{room}</span>
                <span className="font-semibold text-canvas-text">{formatInr(total)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-slate-100 pt-3">
            {( ['materials', 'labor', 'other'] as BudgetLineCategory[]).map((cat) => (
              <div key={cat} className="flex justify-between text-xs font-medium leading-relaxed text-slate-300">
                <span>{BUDGET_CATEGORY_LABELS[cat]}</span>
                <span>{formatInr(summary[cat])}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-subtle">Room line items</h2>
          <button type="button" onClick={addItem} className="rounded-lg bg-canvas-accent-muted px-3 py-1.5 text-xs font-semibold text-canvas-text">
            + Add item
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {items.map((item, index) => (
            <div key={item.id} className="grid grid-cols-2 gap-2 rounded-xl border border-slate-100 bg-canvas-elevated p-3 lg:grid-cols-7">
              <input value={item.room} onChange={(e) => updateItem(index, { room: e.target.value })} className={inputClass} placeholder="Room" />
              <input value={item.name} onChange={(e) => updateItem(index, { name: e.target.value })} className={`${inputClass} lg:col-span-2`} placeholder="Item" />
              <input type="number" min={0} step="any" value={item.quantity} onChange={(e) => updateItem(index, { quantity: Number(e.target.value) || 0 })} className={inputClass} />
              <input type="number" min={0} value={item.unitCost} onChange={(e) => updateItem(index, { unitCost: Number(e.target.value) || 0 })} className={inputClass} />
              <select value={item.category} onChange={(e) => updateItem(index, { category: e.target.value as BudgetLineCategory })} className={inputClass}>
                <option value="materials">Materials</option>
                <option value="labor">Labor</option>
                <option value="other">Other</option>
              </select>
              <div className="flex items-center justify-between gap-2">
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
