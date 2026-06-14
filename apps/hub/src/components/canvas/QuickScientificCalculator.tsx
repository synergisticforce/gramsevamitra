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
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm">
          <p className="min-h-[1.25rem] truncate text-xs text-slate-400">{expression || ' '}</p>
          <p className="text-3xl font-bold tabular-nums text-slate-900">{display}</p>
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
                  ? 'border-violet-600 bg-violet-600 text-white hover:bg-violet-700'
                  : btn.type === 'action'
                    ? 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
                    : btn.type === 'fn'
                      ? 'border-violet-200 bg-violet-50 text-violet-800 hover:border-violet-300'
                      : 'border-slate-200 bg-white text-slate-900 hover:border-violet-200'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Use <code className="text-violet-700">pow(a,b)</code> for powers after tapping xʸ, e.g.{' '}
          <code className="text-violet-700">pow(2,8)</code>
        </p>
      </div>

      <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">History</h3>
        <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto text-sm">
          {history.length === 0 && <li className="text-slate-400">Calculations appear here</li>}
          {history.map((entry, i) => (
            <li
              key={`${entry.expression}-${i}`}
              className="cursor-pointer rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5 hover:border-violet-200"
              onClick={() => {
                setExpression(entry.expression);
                setDisplay(entry.result);
              }}
            >
              <p className="truncate text-xs text-slate-400">{entry.expression}</p>
              <p className="font-semibold tabular-nums text-violet-800">= {entry.result}</p>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
