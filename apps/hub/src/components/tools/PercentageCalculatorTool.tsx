import { useMemo, useState } from 'react';

type Mode = 'percent-of' | 'what-percent' | 'change';

const MODES: { id: Mode; label: string }[] = [
  { id: 'percent-of', label: 'What is X% of Y?' },
  { id: 'what-percent', label: 'X is what % of Y?' },
  { id: 'change', label: '% Increase / Decrease' },
];

function parseNum(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const rounded = Math.round(n * 10000) / 10000;
  return rounded.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export default function PercentageCalculatorTool() {
  const [mode, setMode] = useState<Mode>('percent-of');
  const [x, setX] = useState('');
  const [y, setY] = useState('');

  const result = useMemo(() => {
    const a = parseNum(x);
    const b = parseNum(y);
    if (a === null || b === null) return null;

    if (mode === 'percent-of') {
      return { text: `${formatNum(a)}% of ${formatNum(b)} = ${formatNum((a / 100) * b)}`, detail: null };
    }
    if (mode === 'what-percent') {
      if (b === 0) return { text: 'Cannot divide by zero.', detail: null };
      return { text: `${formatNum(a)} is ${formatNum((a / b) * 100)}% of ${formatNum(b)}`, detail: null };
    }
    if (b === 0) return { text: 'Cannot calculate change from zero.', detail: null };
    const delta = ((a - b) / Math.abs(b)) * 100;
    const direction = delta >= 0 ? 'increase' : 'decrease';
    return {
      text: `${formatNum(Math.abs(delta))}% ${direction}`,
      detail: `From ${formatNum(b)} to ${formatNum(a)} (${delta >= 0 ? '+' : ''}${formatNum(a - b)})`,
    };
  }, [mode, x, y]);

  const xLabel = mode === 'percent-of' ? 'Percentage (X)' : mode === 'what-percent' ? 'Value (X)' : 'New value (X)';
  const yLabel = mode === 'percent-of' ? 'Number (Y)' : mode === 'what-percent' ? 'Total (Y)' : 'Original value (Y)';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition sm:text-sm ${
              mode === m.id
                ? 'border-emerald-500 bg-emerald-950/50 text-emerald-300'
                : 'border-slate-700 bg-slate-950/60 text-slate-400 hover:border-slate-600'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-300">{xLabel}</span>
          <input
            type="number"
            inputMode="decimal"
            value={x}
            onChange={(e) => setX(e.target.value)}
            placeholder="e.g. 15"
            className="input-field w-full tabular-nums"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-300">{yLabel}</span>
          <input
            type="number"
            inputMode="decimal"
            value={y}
            onChange={(e) => setY(e.target.value)}
            placeholder="e.g. 200"
            className="input-field w-full tabular-nums"
          />
        </label>
      </div>

      <div
        className="rounded-2xl border border-emerald-800/40 bg-emerald-950/30 px-5 py-4"
        aria-live="polite"
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400/80">Result</p>
        <p className="mt-2 text-xl font-bold text-white">{result?.text ?? 'Enter values above'}</p>
        {result?.detail && <p className="mt-1 text-sm text-slate-400">{result.detail}</p>}
      </div>
    </div>
  );
}
