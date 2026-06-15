import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  QUICK_TOOLS_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/quickToolsCanvasStorage';
import { md5 } from '../../lib/crypto/hashEngine';

interface FormState {
  input: string;
}

const DEFAULTS: FormState = { input: '' };

const HASH_ROWS = [
  { key: 'md5' as const, label: 'MD5' },
  { key: 'sha256' as const, label: 'SHA-256' },
];

interface Props {
  onToast: (message: string) => void;
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function QuickHashGenerator({ onToast }: Props) {
  const initial = useMemo(
    () => loadPersistedJson<FormState>(QUICK_TOOLS_STORAGE_KEYS.hash, DEFAULTS),
    []
  );
  const [input, setInput] = useState(initial.input);
  const [digests, setDigests] = useState<{ md5: string; sha256: string }>({ md5: '', sha256: '' });
  const requestId = useRef(0);

  useEffect(() => {
    savePersistedJson(QUICK_TOOLS_STORAGE_KEYS.hash, { input });
  }, [input]);

  useEffect(() => {
    if (!input) {
      setDigests({ md5: '', sha256: '' });
      return;
    }

    const id = ++requestId.current;
    const timer = setTimeout(() => {
      void sha256Hex(input).then((sha256) => {
        if (id !== requestId.current) return;
        setDigests({ md5: md5(input), sha256 });
      });
    }, 80);

    return () => clearTimeout(timer);
  }, [input]);

  const copyValue = useCallback(
    async (value: string, label: string) => {
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        onToast(`${label} copied to clipboard.`);
      } catch {
        onToast('Copy failed — select and copy manually.');
      }
    },
    [onToast]
  );

  const inputClass =
    'w-full rounded-xl border border-canvas-border px-3 py-2.5 text-sm text-canvas-text outline-none ring-violet-500/30 focus:border-violet-400 focus:ring-2';

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-subtle">Source text</h2>
        <textarea
          rows={5}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className={`${inputClass} mt-4 resize-y font-mono`}
          placeholder="Type or paste text to hash…"
          spellCheck={false}
        />
        <p className="mt-2 text-xs text-canvas-subtle">
          {input ? 'Digests computed locally via crypto.subtle and MD5.' : 'Type to compute digests locally.'}
        </p>
      </section>

      <section className="space-y-3">
        {HASH_ROWS.map((row) => {
          const value = digests[row.key] || '—';
          return (
            <div
              key={row.key}
              className="grid gap-2 rounded-xl border border-violet-100 bg-canvas-accent-soft/50 p-4 sm:grid-cols-[5.5rem_1fr_auto] sm:items-center"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-canvas-subtle">{row.label}</span>
              <input
                type="text"
                readOnly
                value={value}
                className="min-w-0 rounded-lg border border-canvas-border bg-canvas-surface px-3 py-2 font-mono text-xs text-canvas-text sm:text-sm"
              />
              <button
                type="button"
                disabled={!digests[row.key]}
                onClick={() => void copyValue(digests[row.key], row.label)}
                className="rounded-lg border border-violet-300 bg-canvas-surface px-3 py-2 text-xs font-semibold text-violet-800 transition hover:bg-canvas-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
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
