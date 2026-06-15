import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  QUICK_TOOLS_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/quickToolsCanvasStorage';
import {
  evaluateScientificExpression,
  formatCalcResult,
} from '../../lib/quickTools/scientificCalcEngine';

type HistoryEntry = { expression: string; result: string };

interface CalcState {
  expression: string;
  history: HistoryEntry[];
}

const DEFAULTS: CalcState = { expression: '', history: [] };

const BUTTONS: { label: string; type: 'num' | 'op' | 'fn' | 'action'; value?: string; span?: number }[] = [
  { label: 'sin', type: 'fn', value: 'sin(' },
  { label: 'cos', type: 'fn', value: 'cos(' },
  { label: 'tan', type: 'fn', value: 'tan(' },
  { label: 'log', type: 'fn', value: 'log(' },
  { label: '√', type: 'fn', value: 'sqrt(' },
  { label: 'x²', type: 'fn', value: 'sqr(' },
  { label: 'xʸ', type: 'fn', value: 'pow(' },
  { label: '(', type: 'op', value: '(' },
  { label: ')', type: 'op', value: ')' },
  { label: 'C', type: 'action', value: 'clear' },
  { label: '7', type: 'num', value: '7' },
  { label: '8', type: 'num', value: '8' },
  { label: '9', type: 'num', value: '9' },
  { label: '÷', type: 'op', value: '/' },
  { label: '4', type: 'num', value: '4' },
  { label: '5', type: 'num', value: '5' },
  { label: '6', type: 'num', value: '6' },
  { label: '×', type: 'op', value: '*' },
  { label: '1', type: 'num', value: '1' },
  { label: '2', type: 'num', value: '2' },
  { label: '3', type: 'num', value: '3' },
  { label: '−', type: 'op', value: '-' },
  { label: '0', type: 'num', value: '0' },
  { label: '.', type: 'num', value: '.' },
  { label: 'π', type: 'fn', value: 'π' },
  { label: '+', type: 'op', value: '+' },
  { label: '⌫', type: 'action', value: 'back' },
  { label: '=', type: 'action', value: 'equals', span: 2 },
];

export default function QuickScientificCalculator() {
  const initial = useMemo(
    () => loadPersistedJson<CalcState>(QUICK_TOOLS_STORAGE_KEYS.scientific, DEFAULTS),
    []
  );
  const [expression, setExpression] = useState(initial.expression);
  const [display, setDisplay] = useState(initial.expression || '0');
  const [history, setHistory] = useState<HistoryEntry[]>(initial.history);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    savePersistedJson(QUICK_TOOLS_STORAGE_KEYS.scientific, { expression, history });
  }, [expression, history]);

  const append = useCallback((value: string) => {
    setError(null);
    setExpression((prev) => prev + value);
    setDisplay((prev) => (prev === '0' && /^\d$/.test(value) ? value : prev + value));
  }, []);

  const handleAction = useCallback(
    (action: string) => {
      if (action === 'clear') {
        setExpression('');
        setDisplay('0');
        setError(null);
        return;
      }
      if (action === 'back') {
        setExpression((prev) => prev.slice(0, -1));
        setDisplay((prev) => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
        return;
      }
      if (action === 'equals') {
        if (!expression.trim()) return;
        try {
          const result = evaluateScientificExpression(expression);
          const formatted = formatCalcResult(result);
          setHistory((h) => [{ expression, result: formatted }, ...h].slice(0, 20));
          setDisplay(formatted);
          setExpression(formatted);
          setError(null);
        } catch {
          setError('Invalid expression');
        }
      }
    },
    [expression]
  );

  const handleClick = (btn: (typeof BUTTONS)[number]) => {
    if (btn.type === 'action' && btn.value) {
      handleAction(btn.value);
      return;
    }
    if (btn.value) append(btn.value);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
      <div className="space-y-4">
        <div className="rounded-2xl border border-canvas-border bg-canvas-surface px-4 py-3 text-right shadow-none">
          <p className="min-h-[1.25rem] truncate text-xs font-medium leading-relaxed text-slate-300">{expression || ' '}</p>
          <p className="text-3xl font-bold tabular-nums text-canvas-text">{display}</p>
          {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {BUTTONS.map((btn) => (
            <button
              key={btn.label}
              type="button"
              onClick={() => handleClick(btn)}
              style={btn.span ? { gridColumn: `span ${btn.span}` } : undefined}
              className={`rounded-xl border py-3 text-sm font-semibold transition active:scale-95 ${
                btn.type === 'action' && btn.value === 'equals'
                  ? 'border-violet-600 bg-canvas-accent-muted text-canvas-text hover:bg-canvas-accent/40'
                  : btn.type === 'action'
                    ? 'border-canvas-border bg-canvas-elevated text-canvas-muted hover:bg-canvas-elevated'
                    : btn.type === 'fn'
                      ? 'border-canvas-border bg-canvas-accent-soft text-violet-800 hover:border-violet-300'
                      : 'border-canvas-border bg-canvas-surface text-canvas-text hover:border-canvas-border'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
        <p className="text-xs font-medium leading-relaxed text-slate-300">
          Use <code className="text-canvas-accent">pow(a,b)</code> for powers after tapping xʸ, e.g.{' '}
          <code className="text-canvas-accent">pow(2,8)</code>
        </p>
      </div>

      <aside className="rounded-2xl border border-canvas-border bg-canvas-surface p-4 shadow-none">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-canvas-subtle">History</h3>
        <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto text-sm">
          {history.length === 0 && <li className="text-canvas-subtle">Calculations appear here</li>}
          {history.map((entry, i) => (
            <li
              key={`${entry.expression}-${i}`}
              className="cursor-pointer rounded-lg border border-slate-100 bg-canvas-elevated px-2 py-1.5 hover:border-canvas-border"
              onClick={() => {
                setExpression(entry.expression);
                setDisplay(entry.result);
              }}
            >
              <p className="truncate text-xs font-medium leading-relaxed text-slate-300">{entry.expression}</p>
              <p className="font-semibold tabular-nums text-violet-800">= {entry.result}</p>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
