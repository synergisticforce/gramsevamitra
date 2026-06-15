import { useCallback, useMemo, useState } from 'react';

interface Card {
  question: string;
  answer: string;
}

function parseFlashcards(text: string): Card[] {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  return lines
    .map((line) => {
      const colon = line.match(/^(.+?)\s*:\s*(.+)$/);
      if (colon) return { question: colon[1].trim(), answer: colon[2].trim() };
      const dash = line.match(/^(.+?)\s*[-–—]\s*(.+)$/);
      if (dash) return { question: dash[1].trim(), answer: dash[2].trim() };
      return null;
    })
    .filter((c): c is Card => c !== null && c.question.length > 0 && c.answer.length > 0);
}

export default function FlashcardGeneratorTool() {
  const [raw, setRaw] = useState(
    'Capital of France - Paris\nPhotosynthesis: Process plants use to convert light to energy'
  );
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const cards = useMemo(() => parseFlashcards(raw), [raw]);
  const current = cards[index] ?? null;

  const go = useCallback(
    (delta: number) => {
      if (!cards.length) return;
      setFlipped(false);
      setIndex((i) => (i + delta + cards.length) % cards.length);
    },
    [cards.length]
  );

  return (
    <div className="space-y-6">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-canvas-muted">
          Paste notes — one card per line, separated by <code className="text-canvas-accent">-</code> or{' '}
          <code className="text-canvas-accent">:</code>
        </span>
        <textarea
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setIndex(0);
            setFlipped(false);
          }}
          rows={6}
          className="input-field w-full resize-y font-mono text-sm"
          placeholder={'Question - Answer\nTerm: Definition'}
        />
      </label>

      <p className="text-sm text-canvas-subtle">
        {cards.length} card{cards.length === 1 ? '' : 's'} parsed
      </p>

      {current ? (
        <>
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className="group relative mx-auto flex min-h-[200px] w-full max-w-lg flex-col items-center justify-center rounded-2xl border border-canvas-border bg-gradient-to-br from-slate-900 to-emerald-950/40 p-8 text-center transition hover:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            aria-pressed={flipped}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-canvas-accent/80">
              {flipped ? 'Answer' : 'Question'} · tap to flip
            </p>
            <p className="mt-4 text-lg font-semibold leading-relaxed text-canvas-text">
              {flipped ? current.answer : current.question}
            </p>
          </button>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={() => go(-1)} className="btn-secondary px-4 py-2 text-sm">
              Previous
            </button>
            <span className="text-sm tabular-nums text-canvas-subtle">
              {index + 1} / {cards.length}
            </span>
            <button type="button" onClick={() => go(1)} className="btn-primary px-4 py-2 text-sm">
              Next
            </button>
          </div>
        </>
      ) : (
        <p className="rounded-xl border border-dashed border-canvas-border px-4 py-8 text-center text-sm text-canvas-subtle">
          Add at least one valid line to start studying.
        </p>
      )}
    </div>
  );
}
