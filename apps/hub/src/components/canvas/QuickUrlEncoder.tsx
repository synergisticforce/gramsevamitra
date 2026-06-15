import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  QUICK_TOOLS_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/quickToolsCanvasStorage';
import { decodeUrlComponent, encodeUrlComponent } from '../../lib/quickTools/textCodecEngine';

type Mode = 'encode' | 'decode';

interface FormState {
  mode: Mode;
  input: string;
}

const DEFAULTS: FormState = { mode: 'encode', input: '' };

interface Props {
  onToast: (message: string) => void;
}

export default function QuickUrlEncoder({ onToast }: Props) {
  const initial = useMemo(
    () => loadPersistedJson<FormState>(QUICK_TOOLS_STORAGE_KEYS.url, DEFAULTS),
    []
  );
  const [mode, setMode] = useState<Mode>(initial.mode);
  const [input, setInput] = useState(initial.input);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    savePersistedJson(QUICK_TOOLS_STORAGE_KEYS.url, { mode, input });
  }, [mode, input]);

  useEffect(() => {
    if (!input) {
      setOutput('');
      setError('');
      return;
    }
    try {
      setOutput(mode === 'encode' ? encodeUrlComponent(input) : decodeUrlComponent(input));
      setError('');
    } catch {
      setOutput('');
      setError(mode === 'decode' ? 'Invalid URL-encoded string.' : 'Encoding failed.');
    }
  }, [input, mode]);

  const copyResult = useCallback(async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      onToast('Copied to clipboard.');
    } catch {
      onToast('Copy failed — select and copy manually.');
    }
  }, [onToast, output]);

  const inputClass =
    'w-full rounded-xl border border-canvas-border px-3 py-2.5 font-mono text-sm text-canvas-text outline-none ring-violet-500/30 focus:border-violet-400 focus:ring-2';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-canvas-muted">Mode</p>
        <div className="inline-flex rounded-lg border border-canvas-border bg-canvas-surface p-0.5" role="group">
          {(['encode', 'decode'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md px-4 py-1.5 text-xs font-semibold capitalize ${
                mode === m ? 'bg-canvas-accent-muted text-canvas-text' : 'text-canvas-muted hover:text-canvas-accent'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <label className="block text-sm font-medium text-canvas-muted">
        {mode === 'encode' ? 'Plain text / URL' : 'URL-encoded string'}
        <textarea
          rows={5}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className={`${inputClass} mt-1.5 resize-y`}
          placeholder={mode === 'encode' ? 'Enter text to encode…' : 'Enter % encoded text…'}
          spellCheck={false}
        />
      </label>

      <label className="block text-sm font-medium text-violet-800">
        Result
        <textarea
          rows={5}
          readOnly
          value={output}
          className={`${inputClass} mt-1.5 resize-y bg-canvas-accent-soft/50`}
          placeholder="Result appears here…"
          spellCheck={false}
        />
      </label>

      {error && (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setInput(output)}
          disabled={!output}
          className="rounded-xl border border-canvas-border px-4 py-2 text-sm font-semibold text-canvas-muted hover:bg-canvas-elevated disabled:opacity-50"
        >
          Use output as input
        </button>
        <button
          type="button"
          onClick={() => void copyResult()}
          disabled={!output}
          className="rounded-xl bg-canvas-accent-muted px-4 py-2 text-sm font-semibold text-canvas-text hover:bg-canvas-accent/40 disabled:opacity-50"
        >
          Copy to clipboard
        </button>
        <button
          type="button"
          onClick={() => {
            setInput('');
            setOutput('');
            setError('');
          }}
          className="rounded-xl border border-canvas-border px-4 py-2 text-sm font-semibold text-canvas-muted hover:bg-canvas-elevated"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
