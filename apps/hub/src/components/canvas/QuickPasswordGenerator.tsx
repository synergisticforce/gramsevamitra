import { useCallback, useEffect, useMemo, useState } from 'react';
import { generatePassword, type PasswordOptions } from '../../lib/crypto/passwordEngine';
import {
  QUICK_TOOLS_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/quickToolsCanvasStorage';

interface PasswordFormState {
  length: number;
  numbers: boolean;
  special: boolean;
}

const DEFAULTS: PasswordFormState = {
  length: 16,
  numbers: true,
  special: true,
};

interface Props {
  onToast: (message: string) => void;
}

export default function QuickPasswordGenerator({ onToast }: Props) {
  const initial = useMemo(
    () => loadPersistedJson<PasswordFormState>(QUICK_TOOLS_STORAGE_KEYS.password, DEFAULTS),
    []
  );
  const [length, setLength] = useState(initial.length);
  const [numbers, setNumbers] = useState(initial.numbers);
  const [special, setSpecial] = useState(initial.special);
  const [password, setPassword] = useState('');

  const options: PasswordOptions = useMemo(
    () => ({ length, upper: true, lower: true, numbers, special }),
    [length, numbers, special]
  );

  const regenerate = useCallback(() => {
    const next = generatePassword(options);
    if (!next) {
      onToast('Enable at least numbers or symbols.');
      setPassword('');
      return;
    }
    setPassword(next);
  }, [onToast, options]);

  useEffect(() => {
    savePersistedJson(QUICK_TOOLS_STORAGE_KEYS.password, { length, numbers, special });
  }, [length, numbers, special]);

  useEffect(() => {
    regenerate();
  }, [regenerate]);

  const copyPassword = useCallback(async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      onToast('Password copied to clipboard.');
    } catch {
      onToast('Copy failed — select and copy manually.');
    }
  }, [onToast, password]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Options</h2>
        <div className="mt-4 space-y-6">
          <label className="block">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Length</span>
              <span className="text-sm font-bold tabular-nums text-violet-700">{length}</span>
            </div>
            <input
              type="range"
              min={8}
              max={64}
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
              className="w-full accent-violet-600"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
              <span>8</span>
              <span>64</span>
            </div>
          </label>

          <div className="space-y-3">
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
              <span className="text-sm font-medium text-slate-700">Include numbers (0–9)</span>
              <input
                type="checkbox"
                checked={numbers}
                onChange={(e) => setNumbers(e.target.checked)}
                className="h-5 w-5 accent-violet-600"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
              <span className="text-sm font-medium text-slate-700">Include symbols (!@#$…)</span>
              <input
                type="checkbox"
                checked={special}
                onChange={(e) => setSpecial(e.target.checked)}
                className="h-5 w-5 accent-violet-600"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={regenerate}
            className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
          >
            Regenerate
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-violet-700">Your password</h2>
        <div
          className="mt-4 break-all rounded-xl border border-slate-200 bg-white px-4 py-4 font-mono text-sm leading-relaxed text-slate-900 sm:text-base"
          aria-live="polite"
        >
          {password || '—'}
        </div>
        <button
          type="button"
          onClick={() => void copyPassword()}
          disabled={!password}
          className="mt-4 w-full rounded-xl border border-violet-300 bg-white px-4 py-2.5 text-sm font-semibold text-violet-800 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Copy to clipboard
        </button>
      </section>
    </div>
  );
}
