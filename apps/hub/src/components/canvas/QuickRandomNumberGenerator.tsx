import { useEffect, useMemo, useState } from 'react';
import {
  QUICK_TOOLS_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/quickToolsCanvasStorage';
import { generateRandomIntegers } from '../../lib/quick/quickToolEngines';

interface FormState {
  min: string;
  max: string;
  count: string;
  allowDuplicates: boolean;
}

const DEFAULTS: FormState = {
  min: '1',
  max: '100',
  count: '5',
  allowDuplicates: true,
};

export default function QuickRandomNumberGenerator() {
  const initial = useMemo(
    () => loadPersistedJson<FormState>(QUICK_TOOLS_STORAGE_KEYS.randomNumber, DEFAULTS),
    [],
  );
  const [min, setMin] = useState(initial.min);
  const [max, setMax] = useState(initial.max);
  const [count, setCount] = useState(initial.count);
  const [allowDuplicates, setAllowDuplicates] = useState(initial.allowDuplicates);
  const [results, setResults] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    savePersistedJson(QUICK_TOOLS_STORAGE_KEYS.randomNumber, {
      min,
      max,
      count,
      allowDuplicates,
    });
  }, [allowDuplicates, count, max, min]);

  const inputClass =
    'w-full rounded-xl border border-canvas-border bg-canvas-surface px-3 py-2.5 text-sm text-white outline-none ring-violet-500/30 focus:border-violet-400 focus:ring-2 tabular-nums';

  const generate = () => {
    setError(null);
    try {
      const nums = generateRandomIntegers(
        Number(min),
        Number(max),
        Number(count),
        allowDuplicates,
      );
      setResults(nums);
    } catch (err) {
      setResults([]);
      setError(err instanceof Error ? err.message : 'Could not generate numbers.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-200">Minimum</span>
          <input type="number" value={min} onChange={(e) => setMin(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-200">Maximum</span>
          <input type="number" value={max} onChange={(e) => setMax(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-200">How many?</span>
          <input
            type="number"
            min={1}
            max={10000}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-slate-200">
        <input
          type="checkbox"
          checked={allowDuplicates}
          onChange={(e) => setAllowDuplicates(e.target.checked)}
          className="rounded border-canvas-border"
        />
        Allow duplicate values
      </label>

      <button
        type="button"
        onClick={generate}
        className="rounded-xl bg-canvas-accent-muted px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-canvas-accent/40"
      >
        Generate
      </button>

      {error && (
        <p className="rounded-xl border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      )}

      {results.length > 0 && !error && (
        <div className="rounded-xl border border-canvas-border bg-canvas-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-canvas-accent">Results</p>
          <p className="mt-2 font-mono text-sm leading-relaxed text-slate-200 break-all">
            {results.join(', ')}
          </p>
          <p className="mt-2 text-xs text-slate-300">{results.length} number(s) · crypto-secure random</p>
        </div>
      )}
    </div>
  );
}
