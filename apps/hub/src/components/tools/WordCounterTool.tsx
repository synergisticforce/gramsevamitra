import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'gsm-tools:word-counter';
const WORDS_PER_MINUTE = 200;

function countStats(text: string) {
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
  const chars = text.length;
  const charsNoSpace = text.replace(/\s/g, '').length;
  const sentences = trimmed ? (trimmed.match(/[.!?]+(\s|$)/g) ?? []).length || (trimmed ? 1 : 0) : 0;
  const paragraphs = trimmed ? trimmed.split(/\n\s*\n/).filter((p) => p.trim()).length : 0;
  const readingMinutes = words / WORDS_PER_MINUTE;
  const readingLabel =
    readingMinutes < 1 ? '< 1 min' : `${Math.max(1, Math.round(readingMinutes))} min`;

  return { words, chars, charsNoSpace, sentences, paragraphs, readingLabel };
}

export default function WordCounterTool() {
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState('');

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

  const stats = useMemo(() => countStats(text), [text]);

  const copyText = useCallback(async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setFeedback('Copied to clipboard.');
    } catch {
      setFeedback('Copy failed.');
    }
    setTimeout(() => setFeedback(''), 2000);
  }, [text]);

  const cleanSpaces = useCallback(() => {
    setText((prev) => prev.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim());
    setFeedback('Extra spaces removed.');
    setTimeout(() => setFeedback(''), 2000);
  }, []);

  return (
    <div className="space-y-4">
      <section
        className="rounded-2xl border border-emerald-900/40 bg-gradient-to-br from-emerald-950/40 to-slate-900/60 p-4 shadow-lg sm:p-5"
        aria-label="Live text statistics"
        aria-live="polite"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: 'Words', value: stats.words, className: 'text-emerald-400' },
            { label: 'Characters', value: stats.chars, className: 'text-white' },
            { label: 'No spaces', value: stats.charsNoSpace, className: 'text-slate-300' },
            { label: 'Sentences', value: stats.sentences, className: 'text-amber-400' },
            { label: 'Paragraphs', value: stats.paragraphs, className: 'text-amber-400' },
            { label: 'Read time', value: stats.readingLabel, className: 'text-emerald-300 text-lg sm:text-xl' },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-800/80 bg-slate-950/50 px-3 py-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{item.label}</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${item.className}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Your text</h2>
          <p className="min-h-[1rem] text-xs text-emerald-400" role="status">
            {feedback}
          </p>
        </div>
        <textarea
          rows={12}
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck
          placeholder="Start typing or paste your essay, article, or notes here…"
          className="input-field min-h-[280px] w-full resize-none overflow-hidden leading-relaxed"
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={copyText} disabled={!text} className="btn-primary text-sm">
            Copy to clipboard
          </button>
          <button type="button" onClick={cleanSpaces} disabled={!text} className="btn-secondary text-sm">
            Remove extra spaces
          </button>
          <button type="button" onClick={() => setText('')} className="btn-secondary text-sm">
            Clear
          </button>
        </div>
      </section>
    </div>
  );
}
