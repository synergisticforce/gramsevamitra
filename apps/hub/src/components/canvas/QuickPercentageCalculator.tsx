import { useEffect, useMemo, useState } from 'react';
import {
  QUICK_TOOLS_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/quickToolsCanvasStorage';

type Mode = 'percent-of' | 'what-percent' | 'change';

const MODES: { id: Mode; label: string }[] = [
  { id: 'percent-of', label: 'What is X% of Y?' },
  { id: 'what-percent', label: 'X is what % of Y?' },
  { id: 'change', label: '% Increase / Decrease' },
];

interface FormState {
  mode: Mode;
  x: string;
  y: string;
}

const DEFAULTS: FormState = { mode: 'percent-of', x: '', y: '' };

function parseNum(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return (Math.round(n * 10000) / 10000).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export default function QuickPercentageCalculator() {
  const initial = useMemo(
    () => loadPersistedJson<FormState>(QUICK_TOOLS_STORAGE_KEYS.percentage, DEFAULTS),
    []
  );
  const [mode, setMode] = useState<Mode>(initial.mode);
  const [x, setX] = useState(initial.x);
  const [y, setY] = useState(initial.y);

  useEffect(() => {
    savePersistedJson(QUICK_TOOLS_STORAGE_KEYS.percentage, { mode, x, y });
  }, [mode, x, y]);

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

  const xLabel =
    mode === 'percent-of' ? 'Percentage (X)' : mode === 'what-percent' ? 'Value (X)' : 'New value (X)';
  const yLabel =
    mode === 'percent-of' ? 'Number (Y)' : mode === 'what-percent' ? 'Total (Y)' : 'Original value (Y)';

  const inputClass =
    'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none ring-violet-500/30 focus:border-violet-400 focus:ring-2 tabular-nums';

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
                ? 'border-violet-500 bg-violet-50 text-violet-800'
                : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          {xLabel}
          <input
            type="number"
            inputMode="decimal"
            value={x}
            onChange={(e) => setX(e.target.value)}
            placeholder="e.g. 15"
            className={`${inputClass} mt-1.5`}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          {yLabel}
          <input
            type="number"
            inputMode="decimal"
            value={y}
            onChange={(e) => setY(e.target.value)}
            placeholder="e.g. 200"
            className={`${inputClass} mt-1.5`}
          />
        </label>
      </div>

      <div className="rounded-2xl border border-violet-200 bg-violet-50/80 px-5 py-4" aria-live="polite">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">Result</p>
        <p className="mt-2 text-xl font-bold text-slate-900">{result?.text ?? 'Enter values above'}</p>
        {result?.detail && <p className="mt-1 text-sm text-slate-600">{result.detail}</p>}
      </div>
    </div>
  );
}
