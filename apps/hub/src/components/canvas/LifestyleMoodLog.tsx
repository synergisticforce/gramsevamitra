import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LIFESTYLE_INPUT_CLASS,
  LIFESTYLE_LABEL_CLASS,
  LIFESTYLE_RESULT_PANEL_CLASS,
} from '../../lib/lifestyle/lifestyleUi';
import {
  LIFESTYLE_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/lifestyleCanvasStorage';

export interface MoodLogEntry {
  id: string;
  date: string;
  emoji: string;
  note: string;
  createdAt: string;
}

const MOOD_EMOJIS = ['😊', '😌', '😐', '😔', '😤', '😴', '🤒', '💪', '🙏', '✨'];

const DEFAULTS: { entries: MoodLogEntry[] } = { entries: [] };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function LifestyleMoodLog() {
  const initial = useMemo(
    () => loadPersistedJson<{ entries: MoodLogEntry[] }>(LIFESTYLE_STORAGE_KEYS.moodLog, DEFAULTS),
    [],
  );
  const [entries, setEntries] = useState<MoodLogEntry[]>(initial.entries);
  const [emoji, setEmoji] = useState('😊');
  const [note, setNote] = useState('');
  const [logDate, setLogDate] = useState(todayIso);

  useEffect(() => {
    savePersistedJson(LIFESTYLE_STORAGE_KEYS.moodLog, { entries });
  }, [entries]);

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [entries],
  );

  const saveEntry = useCallback(() => {
    const trimmed = note.trim();
    if (!trimmed) return;

    const entry: MoodLogEntry = {
      id: crypto.randomUUID(),
      date: logDate,
      emoji,
      note: trimmed,
      createdAt: new Date().toISOString(),
    };

    setEntries((prev) => [entry, ...prev]);
    setNote('');
  }, [emoji, logDate, note]);

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return (
    <div className="space-y-6">
      <p className="text-sm font-medium leading-relaxed text-slate-200">
        Private journal — entries are saved only in this browser&apos;s localStorage. Nothing is uploaded.
      </p>

      <div className={`${LIFESTYLE_RESULT_PANEL_CLASS} space-y-4`}>
        <label className="block text-sm">
          <span className={LIFESTYLE_LABEL_CLASS}>Date</span>
          <input
            type="date"
            value={logDate}
            onChange={(e) => setLogDate(e.target.value)}
            className={LIFESTYLE_INPUT_CLASS}
          />
        </label>

        <div>
          <span className={LIFESTYLE_LABEL_CLASS}>Mood</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {MOOD_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={`rounded-xl px-3 py-2 text-xl transition ${
                  emoji === e
                    ? 'bg-canvas-accent-muted ring-2 ring-violet-400'
                    : 'bg-canvas-elevated hover:bg-canvas-surface'
                }`}
                aria-label={`Mood ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <label className="block text-sm">
          <span className={LIFESTYLE_LABEL_CLASS}>Today&apos;s note</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder="How are you feeling? Wins, worries, gratitude…"
            className={`${LIFESTYLE_INPUT_CLASS} resize-y`}
          />
        </label>

        <button
          type="button"
          onClick={saveEntry}
          disabled={!note.trim()}
          className="w-full rounded-xl bg-canvas-accent-muted px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-canvas-accent/40 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          Save entry
        </button>
      </div>

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-canvas-accent">
          Recent entries ({sortedEntries.length})
        </h3>

        {sortedEntries.length === 0 ? (
          <p className="mt-3 text-sm font-medium text-slate-200">No entries yet — log your first mood above.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {sortedEntries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-start gap-3 rounded-xl border border-canvas-border bg-canvas-surface p-4"
              >
                <span className="text-2xl" aria-hidden="true">
                  {entry.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-300">{entry.date}</p>
                  <p className="mt-1 text-sm font-medium leading-relaxed text-slate-200 whitespace-pre-wrap">
                    {entry.note}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteEntry(entry.id)}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-slate-300 transition hover:bg-canvas-elevated hover:text-rose-300"
                  aria-label="Delete entry"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
