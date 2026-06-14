import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  QUICK_TOOLS_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/quickToolsCanvasStorage';
import { base64ToUtf8, utf8ToBase64 } from '../../lib/quickTools/textCodecEngine';

type Mode = 'encode' | 'decode';

interface FormState {
  mode: Mode;
  input: string;
}

const DEFAULTS: FormState = { mode: 'encode', input: '' };

interface Props {
  onToast: (message: string) => void;
}

export default function QuickBase64Tool({ onToast }: Props) {
  const initial = useMemo(
    () => loadPersistedJson<FormState>(QUICK_TOOLS_STORAGE_KEYS.base64, DEFAULTS),
    []
  );
  const [mode, setMode] = useState<Mode>(initial.mode);
  const [input, setInput] = useState(initial.input);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    savePersistedJson(QUICK_TOOLS_STORAGE_KEYS.base64, { mode, input });
  }, [mode, input]);

  useEffect(() => {
    if (!input) {
      setOutput('');
      setError('');
      return;
    }
    try {
      setOutput(mode === 'encode' ? utf8ToBase64(input) : base64ToUtf8(input));
      setError('');
    } catch {
      setOutput('');
      setError(mode === 'decode' ? 'Invalid Base64 string.' : 'Encoding failed.');
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
    'w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-sm text-slate-900 outline-none ring-violet-500/30 focus:border-violet-400 focus:ring-2';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-700">Mode</p>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="group">
          {(['encode', 'decode'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md px-4 py-1.5 text-xs font-semibold capitalize ${
                mode === m ? 'bg-violet-600 text-white' : 'text-slate-600 hover:text-violet-700'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <label className="block text-sm font-medium text-slate-700">
        {mode === 'encode' ? 'Plain text' : 'Base64'}
        <textarea
          rows={5}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className={`${inputClass} mt-1.5 resize-y`}
          placeholder={mode === 'encode' ? 'Enter text to encode…' : 'Enter Base64 to decode…'}
          spellCheck={false}
        />
      </label>

      <label className="block text-sm font-medium text-violet-800">
        Result
        <textarea
          rows={5}
          readOnly
          value={output}
          className={`${inputClass} mt-1.5 resize-y bg-violet-50/50`}
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
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Use output as input
        </button>
        <button
          type="button"
          onClick={() => void copyResult()}
          disabled={!output}
          className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
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
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
