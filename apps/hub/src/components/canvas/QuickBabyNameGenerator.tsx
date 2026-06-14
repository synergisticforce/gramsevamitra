import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  QUICK_TOOLS_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/quickToolsCanvasStorage';

export interface BabyNameEntry {
  name: string;
  origin: 'Indian' | 'Foreign';
  gender: 'Male' | 'Female';
  syllables: number;
}

interface FilterState {
  search: string;
  originFilter: 'All' | 'Indian' | 'Foreign';
  genderFilter: 'All' | 'Male' | 'Female';
  syllableFilter: 'All' | '1 Syllable' | '2 Syllables' | '3+ Syllables';
  letters: string[];
  shortlist: string[];
}

const DATA_URL = '/data/babyNames.json';

const DEFAULTS: FilterState = {
  search: '',
  originFilter: 'All',
  genderFilter: 'All',
  syllableFilter: 'All',
  letters: [],
  shortlist: [],
};

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function matchesSyllableFilter(syllables: number, filter: FilterState['syllableFilter']): boolean {
  if (filter === 'All') return true;
  if (filter === '1 Syllable') return syllables === 1;
  if (filter === '2 Syllables') return syllables === 2;
  return syllables >= 3;
}

export default function QuickBabyNameGenerator() {
  const initial = useMemo(
    () => loadPersistedJson<FilterState>(QUICK_TOOLS_STORAGE_KEYS.babyNames, DEFAULTS),
    []
  );
  const [names, setNames] = useState<BabyNameEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState(initial.search);
  const [originFilter, setOriginFilter] = useState(initial.originFilter);
  const [genderFilter, setGenderFilter] = useState(initial.genderFilter);
  const [syllableFilter, setSyllableFilter] = useState(initial.syllableFilter);
  const [letters, setLetters] = useState(initial.letters);
  const [shortlist, setShortlist] = useState(initial.shortlist);

  useEffect(() => {
    savePersistedJson(QUICK_TOOLS_STORAGE_KEYS.babyNames, {
      search,
      originFilter,
      genderFilter,
      syllableFilter,
      letters,
      shortlist,
    });
  }, [search, originFilter, genderFilter, syllableFilter, letters, shortlist]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(DATA_URL);
        if (!res.ok) throw new Error(`Failed to load names (${res.status})`);
        const data = (await res.json()) as BabyNameEntry[];
        if (!cancelled) setNames(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) {
          setLoadError('Unable to load the name database.');
          setNames([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const availableLetters = useMemo(() => {
    const set = new Set<string>();
    for (const entry of names) {
      const letter = entry.name[0]?.toUpperCase();
      if (letter && /[A-Z]/.test(letter)) set.add(letter);
    }
    return [...set].sort();
  }, [names]);

  const toggleShortlist = useCallback((name: string) => {
    setShortlist((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return names.filter((entry) => {
      if (originFilter !== 'All' && entry.origin !== originFilter) return false;
      if (genderFilter !== 'All' && entry.gender !== genderFilter) return false;
      if (!matchesSyllableFilter(entry.syllables, syllableFilter)) return false;
      if (letters.length && !letters.includes(entry.name[0]?.toUpperCase() ?? '')) return false;
      if (q && !entry.name.toLowerCase().includes(q) && !entry.origin.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [names, search, originFilter, genderFilter, syllableFilter, letters]);

  const randomPick = useCallback(() => {
    if (filtered.length === 0) return;
    const pick = filtered[Math.floor(Math.random() * filtered.length)];
    setSearch(pick.name);
  }, [filtered]);

  const inputClass =
    'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-violet-500/30 focus:border-violet-400 focus:ring-2';

  const pillClass = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
      active ? 'border-violet-500 bg-violet-50 text-violet-800' : 'border-slate-200 bg-white text-slate-600'
    }`;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Filter &amp; search</h2>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Search name
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="e.g. Aarav, Olivia…"
            disabled={loading}
            className={`${inputClass} mt-1.5 disabled:opacity-50`}
          />
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(
            [
              ['Origin', originFilter, setOriginFilter, ['All', 'Indian', 'Foreign']],
              ['Gender', genderFilter, setGenderFilter, ['All', 'Male', 'Female']],
              [
                'Syllables',
                syllableFilter,
                setSyllableFilter,
                ['All', '1 Syllable', '2 Syllables', '3+ Syllables'],
              ],
            ] as const
          ).map(([label, value, setter, options]) => (
            <label key={label} className="block text-xs font-semibold uppercase text-slate-500">
              {label}
              <select
                value={value}
                onChange={(e) => setter(e.target.value as never)}
                disabled={loading}
                className={`${inputClass} mt-1 disabled:opacity-50`}
              >
                {options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        {!loading && availableLetters.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {availableLetters.slice(0, 26).map((letter) => (
              <button
                key={letter}
                type="button"
                onClick={() => setLetters((prev) => toggleInList(prev, letter))}
                className={pillClass(letters.includes(letter))}
                aria-pressed={letters.includes(letter)}
              >
                {letter}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={randomPick}
          disabled={loading || filtered.length === 0}
          className="mt-4 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          Random name from filters
        </button>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-violet-700">
          Shortlist ({shortlist.length})
        </h2>
        <ul className="flex min-h-[44px] flex-wrap gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3">
          {shortlist.length === 0 ? (
            <li className="text-xs text-slate-500">Tap ☆ on any name to add here.</li>
          ) : (
            shortlist.map((name) => (
              <li
                key={name}
                className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800"
              >
                {name}
                <button type="button" onClick={() => toggleShortlist(name)} className="text-rose-500 hover:text-rose-600" aria-label={`Remove ${name}`}>
                  ×
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Names ({loading ? '…' : filtered.length.toLocaleString()})
        </h2>
        {loading && (
          <p className="flex items-center gap-2 text-sm text-violet-700">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
            Loading name database…
          </p>
        )}
        {loadError && <p className="text-sm text-rose-600">{loadError}</p>}
        {!loading && !loadError && filtered.length === 0 && (
          <p className="text-sm text-slate-500">No names match your filters.</p>
        )}
        {!loading && filtered.length > 0 && (
          <ul className="grid max-h-96 gap-2 overflow-y-auto sm:grid-cols-2">
            {filtered.slice(0, 100).map((entry) => {
              const starred = shortlist.includes(entry.name);
              return (
                <li
                  key={`${entry.origin}-${entry.gender}-${entry.name}`}
                  className="flex items-start justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{entry.name}</p>
                    <p className="text-xs text-slate-500">
                      {entry.gender} · {entry.origin} · {entry.syllables} syllable{entry.syllables === 1 ? '' : 's'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleShortlist(entry.name)}
                    className={`shrink-0 rounded-lg border px-2 py-1 text-sm ${
                      starred ? 'border-amber-400 bg-amber-50 text-amber-600' : 'border-slate-200 text-slate-400'
                    }`}
                    aria-label={starred ? 'Remove from shortlist' : 'Add to shortlist'}
                  >
                    {starred ? '★' : '☆'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {!loading && filtered.length > 100 && (
          <p className="mt-2 text-xs text-slate-500">Showing first 100 matches — refine filters to narrow results.</p>
        )}
      </section>
    </div>
  );
}
