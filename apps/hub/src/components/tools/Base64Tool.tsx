import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'gsm-tools:base64';

type Mode = 'encode' | 'decode';

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function base64ToUtf8(b64: string): string {
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export default function Base64Tool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as { mode?: Mode; input?: string };
        if (s.mode) setMode(s.mode);
        if (s.input) setInput(s.input);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const convert = useCallback(
    (text: string, nextMode: Mode) => {
      if (!text) {
        setOutput('');
        setError('');
        return;
      }
      try {
        setOutput(nextMode === 'encode' ? utf8ToBase64(text) : base64ToUtf8(text));
        setError('');
      } catch {
        setOutput('');
        setError(nextMode === 'decode' ? 'Invalid Base64 string.' : 'Encoding failed.');
      }
    },
    [],
  );

  useEffect(() => {
    convert(input, mode);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, input }));
    } catch {
      /* ignore */
    }
  }, [input, mode, convert]);

  const copyResult = useCallback(async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
    } catch {
      /* ignore */
    }
  }, [output]);

  return (
    <section className="rounded-2xl border border-slate-800 bg-canvas-accent-muted/60 p-5 shadow-none sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-subtle">Input &amp; output</h2>
        <div className="inline-flex rounded-lg border border-canvas-border bg-slate-950/60 p-0.5" role="group" aria-label="Encode or decode">
          {(['encode', 'decode'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md px-4 py-1.5 text-xs font-semibold capitalize ${
                mode === m ? 'bg-emerald-950/60 text-canvas-accent' : 'text-canvas-subtle'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-canvas-muted">{mode === 'encode' ? 'Plain text' : 'Base64'}</span>
        <textarea
          rows={6}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="input-field w-full resize-y font-mono text-sm"
          placeholder={mode === 'encode' ? 'Enter text to encode…' : 'Enter Base64 to decode…'}
          spellCheck={false}
        />
      </label>

      <label className="mt-5 block">
        <span className="mb-1 block text-sm font-medium text-canvas-accent/90">Result</span>
        <textarea
          rows={6}
          readOnly
          value={output}
          className="input-field w-full resize-y font-mono text-sm text-canvas-muted"
          placeholder="Result appears here…"
          spellCheck={false}
        />
      </label>

      {error && (
        <p className="mt-2 text-xs text-rose-400" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setInput(output)} disabled={!output} className="btn-secondary text-sm">
          Use output as input
        </button>
        <button type="button" onClick={copyResult} disabled={!output} className="btn-primary text-sm">
          Copy result
        </button>
        <button
          type="button"
          onClick={() => {
            setInput('');
            setOutput('');
            setError('');
          }}
          className="btn-secondary text-sm"
        >
          Clear
        </button>
      </div>
    </section>
  );
}
