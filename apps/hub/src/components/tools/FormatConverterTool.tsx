import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CONVERSION_ROUTES,
  convertFormat,
  validateFormat,
  type FormatKind,
} from '../../lib/dev/formatEngine';

const STORAGE_KEY = 'gsm-tools:format-converter';

export default function FormatConverterTool() {
  const [fromFmt, setFromFmt] = useState<FormatKind>('csv');
  const [toFmt, setToFmt] = useState<FormatKind>('json');
  const [input, setInput] = useState('');
  const [pretty, setPretty] = useState(true);
  const [copyLabel, setCopyLabel] = useState('Copy output');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as { input?: string; from?: FormatKind; to?: FormatKind; pretty?: boolean };
      if (s.input) setInput(s.input);
      if (s.from) setFromFmt(s.from);
      if (s.to) setToFmt(s.to);
      if (typeof s.pretty === 'boolean') setPretty(s.pretty);
    } catch {
      /* ignore */
    }
  }, []);

  const inputError = useMemo(() => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    return validateFormat(fromFmt, trimmed);
  }, [input, fromFmt]);

  const conversion = useMemo(() => {
    if (inputError) return { output: '', error: inputError };
    return convertFormat(fromFmt, toFmt, input, pretty);
  }, [fromFmt, toFmt, input, pretty, inputError]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ input, from: fromFmt, to: toFmt, pretty }));
    } catch {
      /* ignore */
    }
  }, [input, fromFmt, toFmt, pretty]);

  const selectRoute = useCallback((from: FormatKind, to: FormatKind) => {
    setFromFmt(from);
    setToFmt(to);
  }, []);

  const copyOutput = useCallback(async () => {
    if (!conversion.output) return;
    try {
      await navigator.clipboard.writeText(conversion.output);
      setCopyLabel('Copied!');
      setTimeout(() => setCopyLabel('Copy output'), 2000);
    } catch {
      setCopyLabel('Copy failed');
      setTimeout(() => setCopyLabel('Copy output'), 2000);
    }
  }, [conversion.output]);

  const error = inputError ?? conversion.error;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-canvas-accent-muted/60 p-5 shadow-none sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-subtle">Conversion route</h2>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Format selection">
          {CONVERSION_ROUTES.map((route) => {
            const active = route.from === fromFmt && route.to === toFmt;
            return (
              <button
                key={route.label}
                type="button"
                onClick={() => selectRoute(route.from, route.to)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'border-emerald-600 bg-canvas-accent-soft/50 text-canvas-accent'
                    : 'border-canvas-border bg-slate-950/60 text-canvas-subtle hover:border-canvas-border hover:text-canvas-text'
                }`}
              >
                {route.label}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium leading-relaxed text-slate-200">
            <input
              type="checkbox"
              checked={pretty}
              onChange={(e) => setPretty(e.target.checked)}
              className="h-4 w-4 rounded accent-emerald-500"
            />
            Beautify output
          </label>
          <p className="text-xs text-canvas-accent">
            {fromFmt.toUpperCase()} → {toFmt.toUpperCase()}
            {!pretty && ' (minified)'}
          </p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-canvas-subtle">Input ({fromFmt})</h2>
          <textarea
            rows={16}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Paste ${fromFmt.toUpperCase()} here…`}
            className={`input-field w-full resize-y font-mono text-xs ${
              error ? 'border-rose-700/60 ring-1 ring-rose-500/40' : ''
            }`}
            spellCheck={false}
            aria-invalid={Boolean(error)}
          />
          {error && (
            <p className="mt-2 rounded-lg border border-rose-800/60 bg-rose-950/30 px-3 py-2 text-xs text-rose-300" role="alert">
              {error.line ? `Line ${error.line}${error.column ? `, column ${error.column}` : ''}: ` : ''}
              {error.message}
            </p>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-accent/80">Output ({toFmt})</h2>
            <button type="button" onClick={copyOutput} disabled={!conversion.output} className="btn-secondary text-xs">
              {copyLabel}
            </button>
          </div>
          <textarea
            rows={16}
            readOnly
            value={conversion.output}
            className="input-field w-full resize-y font-mono text-xs text-canvas-accent"
            spellCheck={false}
            placeholder="Converted output appears here…"
          />
        </section>
      </div>
    </div>
  );
}
