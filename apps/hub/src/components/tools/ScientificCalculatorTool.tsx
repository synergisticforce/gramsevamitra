import { useCallback, useState } from 'react';

type HistoryEntry = { expression: string; result: string };

const BUTTONS: { label: string; type: 'num' | 'op' | 'fn' | 'action'; value?: string }[] = [
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
  { label: '=', type: 'action', value: 'equals' },
];

function evaluateExpression(raw: string): number {
  let expr = raw.trim();
  if (!expr) throw new Error('Empty');

  expr = expr
    .replace(/π/g, String(Math.PI))
    .replace(/sqrt\(([^()]+)\)/g, 'Math.sqrt($1)')
    .replace(/sin\(([^()]+)\)/g, 'Math.sin($1)')
    .replace(/cos\(([^()]+)\)/g, 'Math.cos($1)')
    .replace(/tan\(([^()]+)\)/g, 'Math.tan($1)')
    .replace(/log\(([^()]+)\)/g, 'Math.log10($1)')
    .replace(/sqr\(([^()]+)\)/g, 'Math.pow($1,2)')
    .replace(/pow\(([^,]+),([^)]+)\)/g, 'Math.pow($1,$2)');

  if (!/^[0-9+\-*/().Math\s]+$/.test(expr.replace(/Math\.(sqrt|sin|cos|tan|log10|pow)/g, ''))) {
    throw new Error('Invalid expression');
  }

  const result = Function(`"use strict"; return (${expr});`)() as unknown;
  if (typeof result !== 'number' || !Number.isFinite(result)) {
    throw new Error('Invalid result');
  }
  return result;
}

export default function ScientificCalculatorTool() {
  const [expression, setExpression] = useState('');
  const [display, setDisplay] = useState('0');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

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
          const result = evaluateExpression(expression);
          const formatted = String(Math.round(result * 1e10) / 1e10);
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
        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-right">
          <p className="min-h-[1.25rem] truncate text-xs text-slate-500">{expression || ' '}</p>
          <p className="text-3xl font-bold tabular-nums text-white">{display}</p>
          {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {BUTTONS.map((btn) => (
            <button
              key={btn.label}
              type="button"
              onClick={() => handleClick(btn)}
              className={`rounded-xl border py-3 text-sm font-semibold transition active:scale-95 ${
                btn.type === 'action' && btn.value === 'equals'
                  ? 'col-span-2 border-emerald-600 bg-emerald-600 text-slate-950 hover:bg-emerald-500'
                  : btn.type === 'action'
                    ? 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'
                    : btn.type === 'fn'
                      ? 'border-slate-700 bg-slate-900 text-emerald-300 hover:border-emerald-700'
                      : 'border-slate-700 bg-slate-900/80 text-white hover:border-slate-600'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Use <code className="text-emerald-400">pow(a,b)</code> for powers after tapping xʸ, e.g.{' '}
          <code className="text-emerald-400">pow(2,8)</code>
        </p>
      </div>

      <aside className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">History</h3>
        <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto text-sm">
          {history.length === 0 && (
            <li className="text-slate-500">Calculations appear here</li>
          )}
          {history.map((entry, i) => (
            <li
              key={`${entry.expression}-${i}`}
              className="cursor-pointer rounded-lg border border-slate-800 bg-slate-950/50 px-2 py-1.5 hover:border-emerald-800"
              onClick={() => {
                setExpression(entry.expression);
                setDisplay(entry.result);
              }}
            >
              <p className="truncate text-xs text-slate-500">{entry.expression}</p>
              <p className="font-semibold tabular-nums text-emerald-300">= {entry.result}</p>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
