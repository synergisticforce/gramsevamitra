import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'gsm-tools:case-converter';

type CaseMode = 'upper' | 'lower' | 'title' | 'sentence' | 'alternating';

function toTitleCase(text: string): string {
  return text.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function toSentenceCase(text: string): string {
  const lower = text.toLowerCase();
  return lower.replace(/(^\s*\w|[.!?]\s+\w)/g, (match) => match.toUpperCase());
}

function toAlternating(text: string): string {
  let upper = false;
  return text
    .split('')
    .map((ch) => {
      if (!/[a-z]/i.test(ch)) return ch;
      const out = upper ? ch.toUpperCase() : ch.toLowerCase();
      upper = !upper;
      return out;
    })
    .join('');
}

const CASE_ACTIONS: { id: CaseMode; label: string; fn: (t: string) => string }[] = [
  { id: 'upper', label: 'UPPERCASE', fn: (t) => t.toUpperCase() },
  { id: 'lower', label: 'lowercase', fn: (t) => t.toLowerCase() },
  { id: 'title', label: 'Title Case', fn: toTitleCase },
  { id: 'sentence', label: 'Sentence case', fn: toSentenceCase },
  { id: 'alternating', label: 'Alternating', fn: toAlternating },
];

export default function CaseConverterTool() {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setText(saved);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, text);
    } catch {
      /* ignore */
    }
  }, [text]);

  const applyCase = useCallback((fn: (t: string) => string, label: string) => {
    setText((prev) => {
      if (!prev) return prev;
      return fn(prev);
    });
    setStatus(`Applied ${label}.`);
    setTimeout(() => setStatus(''), 2000);
  }, []);

  const copyText = useCallback(async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Copied to clipboard.');
    } catch {
      setStatus('Copy failed.');
    }
    setTimeout(() => setStatus(''), 2000);
  }, [text]);

  return (
    <section className="rounded-2xl border border-slate-800 bg-canvas-accent-muted/60 p-5 shadow-none sm:p-6">
      <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Case conversion options">
        {CASE_ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => applyCase(action.fn, action.label)}
            className="rounded-lg border border-canvas-border bg-slate-950/60 px-3 py-2 text-xs font-semibold text-canvas-muted transition hover:border-emerald-600 hover:text-canvas-text"
          >
            {action.label}
          </button>
        ))}
      </div>

      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-medium text-canvas-muted">Your text</span>
        <textarea
          rows={12}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="input-field w-full resize-y text-sm leading-relaxed"
          placeholder="Paste or type text, then tap a case style above…"
          spellCheck
        />
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={copyText} disabled={!text} className="btn-primary flex-1 text-sm">
          Copy to clipboard
        </button>
        <button type="button" onClick={() => setText('')} className="btn-secondary text-sm">
          Clear
        </button>
      </div>

      <p className="mt-2 text-center text-xs text-canvas-subtle" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
