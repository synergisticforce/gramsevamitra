import { useCallback, useRef, useState } from 'react';
import { formatInr } from '../../lib/finance/formatInr';
import {
  parseMarginInput,
  resolveMarginModel,
  type MarginField,
  type MarginModel,
} from '../../lib/finance/marginEngine';

const FIELDS: { id: MarginField; label: string; suffix?: string; isPercent?: boolean }[] = [
  { id: 'cost', label: 'Cost', suffix: '₹' },
  { id: 'revenue', label: 'Revenue', suffix: '₹' },
  { id: 'grossProfit', label: 'Gross profit', suffix: '₹' },
  { id: 'markupPct', label: 'Markup', suffix: '%', isPercent: true },
  { id: 'marginPct', label: 'Margin', suffix: '%', isPercent: true },
];

function modelToStrings(model: MarginModel): Record<MarginField, string> {
  return {
    cost: model.cost !== null ? String(model.cost) : '',
    revenue: model.revenue !== null ? String(model.revenue) : '',
    grossProfit: model.grossProfit !== null ? String(model.grossProfit) : '',
    markupPct: model.markupPct !== null ? String(model.markupPct) : '',
    marginPct: model.marginPct !== null ? String(model.marginPct) : '',
  };
}

function stringsToModel(values: Record<MarginField, string>): MarginModel {
  return {
    cost: parseMarginInput(values.cost),
    revenue: parseMarginInput(values.revenue),
    grossProfit: parseMarginInput(values.grossProfit),
    markupPct: parseMarginInput(values.markupPct),
    marginPct: parseMarginInput(values.marginPct),
  };
}

function initialInputs(): Record<MarginField, string> {
  const seed = { cost: '100', revenue: '150', grossProfit: '', markupPct: '', marginPct: '' };
  return modelToStrings(resolveMarginModel(stringsToModel(seed), 'revenue', 'cost'));
}

export default function MarginCalculatorTool() {
  const [inputs, setInputs] = useState<Record<MarginField, string>>(initialInputs);
  const anchorRef = useRef<MarginField | null>(null);
  const lastEditedRef = useRef<MarginField | null>(null);

  const model = stringsToModel(inputs);
  const hasPair =
    Object.values(model).filter((v) => v !== null).length >= 2;

  const displayModel = hasPair
    ? resolveMarginModel(model, lastEditedRef.current ?? 'cost', anchorRef.current)
    : model;

  const handleChange = useCallback((field: MarginField, value: string) => {
    anchorRef.current = lastEditedRef.current;
    lastEditedRef.current = field;

    const nextInputs = { ...inputs, [field]: value };
    const nextModel = stringsToModel(nextInputs);
    const filled = Object.entries(nextModel).filter(([, v]) => v !== null).length;

    if (filled >= 2) {
      const solved = resolveMarginModel(nextModel, field, anchorRef.current);
      setInputs(modelToStrings(solved));
    } else {
      setInputs(nextInputs);
    }
  }, [inputs]);

  const profitBar =
    displayModel.revenue && displayModel.revenue > 0 && displayModel.grossProfit !== null
      ? Math.max(0, Math.min(100, (displayModel.grossProfit / displayModel.revenue) * 100))
      : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-800 bg-canvas-accent-muted/60 p-5 shadow-none sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-subtle">
          Margin &amp; markup matrix
        </h2>
        <p className="mt-2 text-xs font-medium leading-relaxed text-slate-300">
          Edit any two fields — the remaining values resolve automatically across the model.
        </p>

        <div className="mt-5 space-y-4">
          {FIELDS.map((f) => (
            <label key={f.id} className="block">
              <span className="mb-1 block text-sm font-medium text-canvas-muted">
                {f.label}
                {f.suffix && <span className="text-canvas-subtle"> ({f.suffix})</span>}
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={inputs[f.id]}
                onChange={(e) => handleChange(f.id, e.target.value)}
                placeholder={f.isPercent ? 'e.g. 25' : '0'}
                className="input-field w-full tabular-nums"
              />
            </label>
          ))}

          <button
            type="button"
            onClick={() => {
              anchorRef.current = null;
              lastEditedRef.current = null;
              setInputs(initialInputs());
            }}
            className="btn-secondary w-full text-sm"
          >
            Reset
          </button>
        </div>
      </section>

      <section
        className="rounded-2xl border border-canvas-border bg-gradient-to-br from-emerald-950/50 to-slate-900/60 p-5 shadow-none sm:p-6"
        aria-live="polite"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-accent/80">Profit matrix</h2>

        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="flex justify-between text-sm">
              <span className="text-canvas-subtle">Cost</span>
              <span className="font-semibold tabular-nums text-canvas-text">
                {displayModel.cost !== null ? formatInr(displayModel.cost, 2) : '—'}
              </span>
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-canvas-subtle">Revenue</span>
              <span className="font-semibold tabular-nums text-canvas-accent">
                {displayModel.revenue !== null ? formatInr(displayModel.revenue, 2) : '—'}
              </span>
            </div>
            <div className="mt-2 flex justify-between border-t border-slate-800 pt-2 text-sm">
              <span className="text-canvas-subtle">Gross profit</span>
              <span
                className={`font-semibold tabular-nums ${
                  (displayModel.grossProfit ?? 0) >= 0 ? 'text-amber-300' : 'text-red-400'
                }`}
              >
                {displayModel.grossProfit !== null ? formatInr(displayModel.grossProfit, 2) : '—'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-canvas-subtle">Markup</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-canvas-text">
                {displayModel.markupPct !== null ? `${displayModel.markupPct.toFixed(2)}%` : '—'}
              </p>
              <p className="mt-1 text-[10px] text-canvas-subtle">Profit ÷ Cost</p>
            </div>
            <div className="rounded-xl border border-canvas-border bg-canvas-accent-soft/30 p-4 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-canvas-accent/80">Margin</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-canvas-accent">
                {displayModel.marginPct !== null ? `${displayModel.marginPct.toFixed(2)}%` : '—'}
              </p>
              <p className="mt-1 text-[10px] text-canvas-subtle">Profit ÷ Revenue</p>
            </div>
          </div>

          {profitBar > 0 && (
            <div>
              <div className="mb-1 flex justify-between text-xs font-medium leading-relaxed text-slate-300">
                <span>Cost portion</span>
                <span>Profit margin</span>
              </div>
              <div className="flex h-3 overflow-hidden rounded-full bg-canvas-elevated">
                <div className="bg-canvas-accent-muted" style={{ width: `${100 - profitBar}%` }} />
                <div className="bg-canvas-accent-soft0" style={{ width: `${profitBar}%` }} />
              </div>
            </div>
          )}

          {displayModel.cost !== null &&
            displayModel.revenue !== null &&
            displayModel.grossProfit !== null && (
              <p className="text-center text-xs font-medium leading-relaxed text-slate-300">
                Selling at {formatInr(displayModel.revenue, 2)} with cost {formatInr(displayModel.cost, 2)} yields{' '}
                {formatInr(displayModel.grossProfit, 2)} profit (
                {displayModel.marginPct?.toFixed(1)}% margin, {displayModel.markupPct?.toFixed(1)}% markup).
              </p>
            )}
        </div>
      </section>
    </div>
  );
}
