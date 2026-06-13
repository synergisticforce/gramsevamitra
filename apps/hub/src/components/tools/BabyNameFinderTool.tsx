import { useCallback, useEffect, useMemo, useState } from 'react';

export interface BabyNameEntry {
  name: string;
  origin: 'Indian' | 'Foreign';
  gender: 'Male' | 'Female';
  syllables: number;
}

const SHORTLIST_KEY = 'gsm-tools:baby-names-shortlist';
const DATA_URL = '/data/babyNames.json';

const ORIGIN_OPTIONS = ['All', 'Indian', 'Foreign'] as const;
const GENDER_OPTIONS = ['All', 'Male', 'Female'] as const;
const SYLLABLE_OPTIONS = ['All', '1 Syllable', '2 Syllables', '3+ Syllables'] as const;

type OriginFilter = (typeof ORIGIN_OPTIONS)[number];
type GenderFilter = (typeof GENDER_OPTIONS)[number];
type SyllableFilter = (typeof SYLLABLE_OPTIONS)[number];

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function matchesSyllableFilter(syllables: number, filter: SyllableFilter): boolean {
  if (filter === 'All') return true;
  if (filter === '1 Syllable') return syllables === 1;
  if (filter === '2 Syllables') return syllables === 2;
  return syllables >= 3;
}

function NamesSkeleton() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2" aria-busy="true" aria-label="Loading baby names">
      {Array.from({ length: 8 }, (_, i) => (
        <li
          key={i}
          className="animate-pulse rounded-xl border border-slate-800 bg-slate-900/50 p-3"
        >
          <div className="h-4 w-24 rounded bg-slate-700" />
          <div className="mt-2 h-3 w-32 rounded bg-slate-800" />
        </li>
      ))}
    </ul>
  );
}

export default function BabyNameFinderTool() {
  const [names, setNames] = useState<BabyNameEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [originFilter, setOriginFilter] = useState<OriginFilter>('All');
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('All');
  const [syllableFilter, setSyllableFilter] = useState<SyllableFilter>('All');
  const [letters, setLetters] = useState<string[]>([]);
  const [shortlist, setShortlist] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(SHORTLIST_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  const availableLetters = useMemo(() => {
    const set = new Set<string>();
    for (const entry of names) {
      const letter = entry.name[0]?.toUpperCase();
      if (letter && /[A-Z]/.test(letter)) set.add(letter);
    }
    return [...set].sort();
  }, [names]);

  useEffect(() => {
    let cancelled = false;

    async function loadNames() {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(DATA_URL);
        if (!res.ok) throw new Error(`Failed to load names (${res.status})`);
        const data = (await res.json()) as BabyNameEntry[];
        if (!cancelled) setNames(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) {
          setLoadError('Unable to load the name database. Please refresh and try again.');
          setNames([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadNames();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistShortlist = useCallback((next: string[]) => {
    setShortlist(next);
    try {
      localStorage.setItem(SHORTLIST_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleShortlist = useCallback(
    (name: string) => {
      persistShortlist(
        shortlist.includes(name) ? shortlist.filter((n) => n !== name) : [...shortlist, name]
      );
    },
    [shortlist, persistShortlist]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return names.filter((entry) => {
      if (originFilter !== 'All' && entry.origin !== originFilter) return false;
      if (genderFilter !== 'All' && entry.gender !== genderFilter) return false;
      if (!matchesSyllableFilter(entry.syllables, syllableFilter)) return false;
      if (letters.length && !letters.includes(entry.name[0]?.toUpperCase() ?? '')) return false;
      if (q && !entry.name.toLowerCase().includes(q) && !entry.origin.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [names, search, originFilter, genderFilter, syllableFilter, letters]);

  const pillClass = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
      active
        ? 'border-emerald-600 bg-emerald-950/50 text-emerald-300'
        : 'border-slate-700 bg-slate-950/60 text-slate-400 hover:border-slate-600'
    }`;

  const hasActiveFilters =
    originFilter !== 'All' ||
    genderFilter !== 'All' ||
    syllableFilter !== 'All' ||
    letters.length > 0;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Filter &amp; search</h2>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-slate-300">Search name</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="e.g. Aarav, Olivia…"
            disabled={loading}
            className="input-field w-full disabled:opacity-50"
          />
        </label>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Origin
            </span>
            <select
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value as OriginFilter)}
              disabled={loading}
              className="input-field w-full disabled:opacity-50"
            >
              {ORIGIN_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Gender
            </span>
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value as GenderFilter)}
              disabled={loading}
              className="input-field w-full disabled:opacity-50"
            >
              {GENDER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Syllables
            </span>
            <select
              value={syllableFilter}
              onChange={(e) => setSyllableFilter(e.target.value as SyllableFilter)}
              disabled={loading}
              className="input-field w-full disabled:opacity-50"
            >
              {SYLLABLE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!loading && availableLetters.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Starting letter</p>
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-9 md:grid-cols-[repeat(13,minmax(0,1fr))]">
              {availableLetters.map((letter) => (
                <button
                  key={letter}
                  type="button"
                  onClick={() => setLetters((prev) => toggleInList(prev, letter))}
                  className={`${pillClass(letters.includes(letter))} px-2 py-1.5 text-center`}
                  aria-pressed={letters.includes(letter)}
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>
        )}

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setOriginFilter('All');
              setGenderFilter('All');
              setSyllableFilter('All');
              setLetters([]);
            }}
            className="btn-secondary mt-4 text-xs"
          >
            Clear filters
          </button>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-emerald-400/80">
          Shortlist <span className="text-slate-500">({shortlist.length})</span>
        </h2>
        <ul className="flex min-h-[48px] flex-wrap gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-3">
          {shortlist.length === 0 ? (
            <li className="text-xs text-slate-500">Tap ☆ on any name to add here.</li>
          ) : (
            shortlist.map((name) => (
              <li
                key={name}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-800/60 bg-emerald-950/40 px-2.5 py-1 text-xs font-medium text-emerald-300"
              >
                {name}
                <button
                  type="button"
                  onClick={() => toggleShortlist(name)}
                  className="text-rose-400 hover:text-rose-300"
                  aria-label={`Remove ${name}`}
                >
                  ×
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Names{' '}
          <span className="text-slate-600">
            ({loading ? '…' : filtered.length.toLocaleString()})
          </span>
        </h2>

        {loading && (
          <div className="mb-4 flex items-center gap-2 text-sm text-emerald-300" role="status">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
            Loading name database…
          </div>
        )}

        {loadError && (
          <p className="rounded-lg border border-rose-800/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-300" role="alert">
            {loadError}
          </p>
        )}

        {!loading && !loadError && filtered.length === 0 ? (
          <p className="text-center text-sm text-slate-500">No names match your filters.</p>
        ) : loading ? (
          <NamesSkeleton />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {filtered.map((entry) => {
              const starred = shortlist.includes(entry.name);
              const syllableLabel = `${entry.syllables} syllable${entry.syllables === 1 ? '' : 's'}`;
              return (
                <li
                  key={`${entry.origin}-${entry.gender}-${entry.name}`}
                  className="flex items-start justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-3 transition hover:border-slate-700"
                >
                  <div>
                    <p className="font-semibold text-white">
                      {entry.name}
                      <span className="ml-2 text-sm font-normal text-emerald-400/90">{syllableLabel}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {entry.gender} · {entry.origin}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleShortlist(entry.name)}
                    className={`shrink-0 rounded-lg border px-2 py-1 text-sm transition ${
                      starred
                        ? 'border-amber-600 bg-amber-950/40 text-amber-400'
                        : 'border-slate-700 text-slate-500 hover:border-amber-600 hover:text-amber-400'
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
      </section>
    </div>
  );
}
