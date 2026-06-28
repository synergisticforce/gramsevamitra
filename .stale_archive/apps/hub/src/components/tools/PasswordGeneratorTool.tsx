import { useCallback, useState } from 'react';
import { generatePassword, type PasswordOptions } from '../../lib/crypto/passwordEngine';

export default function PasswordGeneratorTool() {
  const [length, setLength] = useState(16);
  const [upper, setUpper] = useState(true);
  const [lower, setLower] = useState(true);
  const [numbers, setNumbers] = useState(true);
  const [special, setSpecial] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const options: PasswordOptions = { length, upper, lower, numbers, special };

  const regenerate = useCallback(() => {
    const next = generatePassword(options);
    if (!next) {
      setError('Select at least one character set.');
      setPassword('');
      return;
    }
    setError('');
    setPassword(next);
  }, [options]);

  const copyPassword = useCallback(async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setFeedback('Copied to clipboard.');
    } catch {
      setFeedback('Copy failed — select and copy manually.');
    }
    setTimeout(() => setFeedback(''), 2000);
  }, [password]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-800 bg-canvas-accent-muted/60 p-5 shadow-none sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-subtle">Options</h2>
        <div className="mt-5 space-y-6">
          <label className="block">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-canvas-muted">Length</span>
              <span className="text-sm font-bold tabular-nums text-canvas-accent">{length}</span>
            </div>
            <input
              type="range"
              min={8}
              max={128}
              value={length}
              onChange={(e) => {
                setLength(Number(e.target.value));
              }}
              className="w-full accent-emerald-500"
            />
            <div className="mt-1 flex justify-between text-[10px] text-canvas-subtle">
              <span>8</span>
              <span>128</span>
            </div>
          </label>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-canvas-muted">Character sets</legend>
            {[
              { id: 'upper', label: 'Uppercase (A–Z)', checked: upper, set: setUpper },
              { id: 'lower', label: 'Lowercase (a–z)', checked: lower, set: setLower },
              { id: 'numbers', label: 'Numbers (0–9)', checked: numbers, set: setNumbers },
              { id: 'special', label: 'Symbols (!@#$…)', checked: special, set: setSpecial },
            ].map((item) => (
              <label key={item.id} className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={(e) => item.set(e.target.checked)}
                  className="h-4 w-4 accent-emerald-500"
                />
                <span className="text-sm font-medium leading-relaxed text-slate-200">{item.label}</span>
              </label>
            ))}
          </fieldset>

          {error && (
            <p className="text-xs text-rose-400" role="alert">
              {error}
            </p>
          )}

          <button type="button" onClick={regenerate} className="btn-primary w-full text-sm">
            Generate password
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-canvas-border bg-gradient-to-br from-emerald-950/50 to-slate-900/60 p-5 shadow-none sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-accent/80">Your password</h2>
        <div className="mt-5">
          <div
            className="break-all rounded-xl border border-canvas-border bg-slate-950/80 px-4 py-4 font-mono text-sm leading-relaxed text-canvas-text sm:text-base"
            aria-live="polite"
          >
            {password || '—'}
          </div>
          <p className="mt-2 min-h-[1rem] text-center text-xs text-canvas-accent" role="status">
            {feedback}
          </p>
          <button type="button" onClick={copyPassword} disabled={!password} className="btn-primary mt-4 w-full">
            Copy to clipboard
          </button>
        </div>
      </section>
    </div>
  );
}
