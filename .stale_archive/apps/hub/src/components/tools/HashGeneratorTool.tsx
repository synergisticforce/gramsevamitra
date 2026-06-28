import { useCallback, useEffect, useRef, useState } from 'react';
import { computeAllHashes } from '../../lib/crypto/hashEngine';

const STORAGE_KEY = 'gsm-tools:hash-generator';

const HASH_ROWS = [
  { key: 'md5' as const, label: 'MD5' },
  { key: 'sha1' as const, label: 'SHA-1' },
  { key: 'sha256' as const, label: 'SHA-256' },
  { key: 'sha512' as const, label: 'SHA-512' },
];

export default function HashGeneratorTool() {
  const [input, setInput] = useState('');
  const [digests, setDigests] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('Type to compute digests locally.');
  const requestId = useRef(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setInput(saved);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const trimmed = input;
    if (!trimmed) {
      setDigests({});
      setStatus('Type to compute digests locally.');
      return;
    }

    const id = ++requestId.current;
    setStatus('Computing…');

    const timer = setTimeout(() => {
      void computeAllHashes(trimmed).then((result) => {
        if (id !== requestId.current) return;
        setDigests(result);
        setStatus('Digests ready — computed offline.');
        try {
          localStorage.setItem(STORAGE_KEY, trimmed);
        } catch {
          /* ignore */
        }
      });
    }, 120);

    return () => clearTimeout(timer);
  }, [input]);

  const copyValue = useCallback(async (value: string, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setStatus(`${label} copied.`);
    } catch {
      setStatus('Copy failed.');
    }
    setTimeout(() => setStatus('Digests ready — computed offline.'), 2000);
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-canvas-accent-muted/60 p-5 shadow-none sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-subtle">Source text</h2>
        <textarea
          rows={5}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="input-field mt-4 w-full resize-y text-sm"
          placeholder="Type or paste text to hash…"
          spellCheck={false}
        />
        <p className="mt-2 text-xs font-medium leading-relaxed text-slate-300" aria-live="polite">
          {status}
        </p>
      </section>

      <section className="space-y-3" aria-labelledby="hash-output-heading">
        <h2 id="hash-output-heading" className="text-sm font-semibold uppercase tracking-wider text-canvas-accent/80">
          Digests
        </h2>
        {HASH_ROWS.map((row) => {
          const value = digests[row.key] ?? '—';
          return (
            <div
              key={row.key}
              className="grid gap-2 rounded-xl border border-canvas-border bg-gradient-to-br from-emerald-950/30 to-slate-900/60 p-3 sm:grid-cols-[5rem_1fr_auto] sm:items-center sm:gap-3 sm:p-4"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-canvas-subtle">{row.label}</span>
              <input
                type="text"
                readOnly
                value={value}
                className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 font-mono text-xs text-canvas-accent sm:text-sm"
              />
              <button
                type="button"
                disabled={!digests[row.key]}
                onClick={() => copyValue(digests[row.key], row.label)}
                className="rounded-lg border border-emerald-700/60 bg-canvas-accent-soft/40 px-3 py-2 text-xs font-semibold text-canvas-accent transition hover:border-canvas-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                Copy
              </button>
            </div>
          );
        })}
      </section>
    </div>
  );
}
