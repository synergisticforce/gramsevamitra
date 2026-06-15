import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Chart } from 'chart.js';
import { destroyChart, gsmTooltipOptions, renderChart } from '../../lib/charts/chartHelper';
import {
  FINANCE_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/financeCanvasStorage';
import { calculateDiscount } from '../../lib/finance/discountEngine';
import { clamp, formatInr } from '../../lib/finance/formatInr';
import {
  parseMarginInput,
  resolveMarginModel,
  type MarginField,
  type MarginModel,
} from '../../lib/finance/marginEngine';

type Tab = 'discount' | 'margin';

interface DiscountFormState {
  originalPrice: number;
  discountPercent: number;
  flatDiscount: number;
  taxPercent: number;
}

interface MarginPersistState {
  inputs: Record<MarginField, string>;
  lastEdited: MarginField | null;
  anchor: MarginField | null;
}

interface FormState extends DiscountFormState {
  tab: Tab;
  margin: MarginPersistState;
}

const DISCOUNT_DEFAULTS: DiscountFormState = {
  originalPrice: 2_499,
  discountPercent: 15,
  flatDiscount: 0,
  taxPercent: 18,
};

const MARGIN_SEED: Record<MarginField, string> = {
  cost: '1000',
  revenue: '1500',
  grossProfit: '',
  markupPct: '',
  marginPct: '',
};

const DEFAULTS: FormState = {
  ...DISCOUNT_DEFAULTS,
  tab: 'discount',
  margin: { inputs: MARGIN_SEED, lastEdited: 'revenue', anchor: 'cost' },
};

const LIGHT_LEGEND = {
  labels: { color: '#64748b', boxWidth: 12, padding: 12, font: { size: 11 } },
};

function stringsToModel(values: Record<MarginField, string>): MarginModel {
  return {
    cost: parseMarginInput(values.cost),
    revenue: parseMarginInput(values.revenue),
    grossProfit: parseMarginInput(values.grossProfit),
    markupPct: parseMarginInput(values.markupPct),
    marginPct: parseMarginInput(values.marginPct),
  };
}

function modelToStrings(model: MarginModel): Record<MarginField, string> {
  return {
    cost: model.cost !== null ? String(model.cost) : '',
    revenue: model.revenue !== null ? String(model.revenue) : '',
    grossProfit: model.grossProfit !== null ? String(model.grossProfit) : '',
    markupPct: model.markupPct !== null ? String(model.markupPct) : '',
    marginPct: model.marginPct !== null ? String(model.marginPct) : '',
  };
}

export default function FinanceDiscountMarginCalculator() {
  const initial = useMemo(
    () => loadPersistedJson<FormState>(FINANCE_STORAGE_KEYS.discount, DEFAULTS),
    []
  );

  const [tab, setTab] = useState<Tab>(initial.tab);
  const [originalPrice, setOriginalPrice] = useState(initial.originalPrice);
  const [discountPercent, setDiscountPercent] = useState(initial.discountPercent);
  const [flatDiscount, setFlatDiscount] = useState(initial.flatDiscount);
  const [taxPercent, setTaxPercent] = useState(initial.taxPercent);
  const [marginInputs, setMarginInputs] = useState(initial.margin.inputs);
  const [lastEdited, setLastEdited] = useState<MarginField | null>(initial.margin.lastEdited);
  const [anchor, setAnchor] = useState<MarginField | null>(initial.margin.anchor);

  const chartRef = useRef<HTMLCanvasElement>(null);
  const chart = useRef<Chart | null>(null);

  const discountResult = useMemo(
    () => calculateDiscount(originalPrice, discountPercent, flatDiscount, taxPercent),
    [originalPrice, discountPercent, flatDiscount, taxPercent]
  );

  const marginModel = useMemo(() => {
    const model = stringsToModel(marginInputs);
    const filled = Object.values(model).filter((v) => v !== null).length;
    if (filled < 2) return model;
    return resolveMarginModel(model, lastEdited ?? 'cost', anchor);
  }, [anchor, lastEdited, marginInputs]);

  useEffect(() => {
    savePersistedJson(FINANCE_STORAGE_KEYS.discount, {
      tab,
      originalPrice,
      discountPercent,
      flatDiscount,
      taxPercent,
      margin: { inputs: marginInputs, lastEdited, anchor },
    });
  }, [tab, originalPrice, discountPercent, flatDiscount, taxPercent, marginInputs, lastEdited, anchor]);

  const handleMarginChange = useCallback(
    (field: MarginField, value: string) => {
      setAnchor(lastEdited);
      setLastEdited(field);
      const nextInputs = { ...marginInputs, [field]: value };
      const nextModel = stringsToModel(nextInputs);
      const filled = Object.values(nextModel).filter((v) => v !== null).length;
      if (filled >= 2) {
        setMarginInputs(modelToStrings(resolveMarginModel(nextModel, field, lastEdited)));
      } else {
        setMarginInputs(nextInputs);
      }
    },
    [lastEdited, marginInputs]
  );

  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas) return;

    if (tab === 'discount' && discountResult) {
      void (async () => {
        chart.current = await renderChart(canvas, chart.current, {
          type: 'doughnut',
          data: {
            labels: ['You pay', 'You save', 'Tax'],
            datasets: [
              {
                data: [
                  Math.round(discountResult.priceAfterDiscount),
                  Math.round(discountResult.discountAmount),
                  Math.round(discountResult.taxAmount),
                ],
                backgroundColor: ['#059669', '#6366f1', '#d97706'],
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
    }

    if (tab === 'margin' && marginModel.cost !== null && marginModel.revenue !== null) {
      const profit = marginModel.grossProfit ?? 0;
      const cost = marginModel.cost;
      void (async () => {
        chart.current = await renderChart(canvas, chart.current, {
          type: 'bar',
          data: {
            labels: ['Revenue split'],
            datasets: [
              { label: 'Cost', data: [Math.round(cost)], backgroundColor: '#94a3b8', borderRadius: 4 },
              {
                label: 'Profit',
                data: [Math.round(Math.max(0, profit))],
                backgroundColor: '#059669',
                borderRadius: 4,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: { stacked: true, grid: { display: false }, ticks: { display: false } },
              y: { stacked: true, ticks: { callback: (v) => formatInr(Number(v)) } },
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
    }

    chart.current = destroyChart(chart.current);
  }, [tab, discountResult, marginModel]);

  const inputClass =
    'w-full rounded-xl border border-canvas-border px-3 py-2.5 text-sm text-canvas-text outline-none ring-canvas-accent/50/30 focus:border-canvas-accent focus:ring-2 tabular-nums';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(['discount', 'margin'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
              tab === t
                ? 'border-canvas-accent bg-canvas-accent-soft text-canvas-accent'
                : 'border-canvas-border bg-canvas-surface text-canvas-muted hover:border-emerald-300'
            }`}
          >
            {t === 'discount' ? 'Discount & tax' : 'Margin & markup'}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
          {tab === 'discount' ? (
            <>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-subtle">Discount</h2>
              <div className="mt-4 space-y-4">
                <label className="block text-sm font-medium text-canvas-muted">
                  Original price (₹)
                  <input
                    type="number"
                    min={1}
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(clamp(Number(e.target.value) || 0, 1, 10_000_000))}
                    className={`${inputClass} mt-1.5`}
                  />
                </label>
                <label className="block text-sm font-medium text-canvas-muted">
                  Discount ({discountPercent}%)
                  <input
                    type="range"
                    min={0}
                    max={90}
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Number(e.target.value))}
                    className="mt-2 w-full accent-emerald-600"
                  />
                </label>
                <label className="block text-sm font-medium text-canvas-muted">
                  Flat discount (₹)
                  <input
                    type="number"
                    min={0}
                    value={flatDiscount}
                    onChange={(e) => setFlatDiscount(Math.max(0, Number(e.target.value) || 0))}
                    className={`${inputClass} mt-1.5`}
                  />
                </label>
                <label className="block text-sm font-medium text-canvas-muted">
                  Sales tax / GST ({taxPercent}%)
                  <input
                    type="range"
                    min={0}
                    max={28}
                    step={1}
                    value={taxPercent}
                    onChange={(e) => setTaxPercent(Number(e.target.value))}
                    className="mt-2 w-full accent-emerald-600"
                  />
                </label>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-subtle">Margin matrix</h2>
              <p className="mt-1 text-xs font-medium leading-relaxed text-slate-300">Edit any two fields — the rest resolve automatically.</p>
              <div className="mt-4 space-y-3">
                {(
                  [
                    ['cost', 'Cost (₹)'],
                    ['revenue', 'Revenue (₹)'],
                    ['grossProfit', 'Gross profit (₹)'],
                    ['markupPct', 'Markup (%)'],
                    ['marginPct', 'Margin (%)'],
                  ] as const
                ).map(([field, label]) => (
                  <label key={field} className="block text-sm font-medium text-canvas-muted">
                    {label}
                    <input
                      type="number"
                      value={marginInputs[field]}
                      onChange={(e) => handleMarginChange(field, e.target.value)}
                      className={`${inputClass} mt-1.5`}
                    />
                  </label>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-canvas-border bg-gradient-to-br from-canvas-accent-soft/40 to-canvas-surface p-5 shadow-none">
          {tab === 'discount' && discountResult ? (
            <>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-accent">Final price</h2>
              <p className="mt-3 text-3xl font-bold tabular-nums text-canvas-accent">
                {formatInr(Math.round(discountResult.finalPrice))}
              </p>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-canvas-subtle">After discount</dt>
                  <dd className="font-semibold">{formatInr(Math.round(discountResult.priceAfterDiscount))}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-canvas-subtle">Total savings</dt>
                  <dd className="font-semibold text-indigo-700">
                    {formatInr(Math.round(discountResult.discountAmount))} (
                    {discountResult.savingsPercent.toFixed(1)}%)
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-accent">Profit summary</h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-canvas-subtle">Margin</dt>
                  <dd className="font-bold text-canvas-accent">
                    {marginModel.marginPct !== null ? `${marginModel.marginPct.toFixed(2)}%` : '—'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-canvas-subtle">Markup</dt>
                  <dd className="font-semibold">
                    {marginModel.markupPct !== null ? `${marginModel.markupPct.toFixed(2)}%` : '—'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-canvas-subtle">Gross profit</dt>
                  <dd className="font-semibold">
                    {marginModel.grossProfit !== null ? formatInr(marginModel.grossProfit, 2) : '—'}
                  </dd>
                </div>
              </dl>
            </>
          )}
          <div className="relative mt-5 h-48 rounded-xl border border-slate-100 bg-canvas-surface p-2">
            <canvas ref={chartRef} aria-label="Discount or margin chart" />
          </div>
        </section>
      </div>
    </div>
  );
}
