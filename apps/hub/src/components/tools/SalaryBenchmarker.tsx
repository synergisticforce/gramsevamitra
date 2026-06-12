import { useCallback, useEffect, useMemo, useState } from 'react';

interface SalaryBand {
  label: string;
  min: number;
  mid: number;
  max: number;
}

interface SalaryRole {
  role: string;
  bands: Record<string, SalaryBand>;
}

const STORAGE_KEY = 'gsm-tools:salary-benchmark';

export default function SalaryBenchmarker() {
  const [roles, setRoles] = useState<SalaryRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [experienceKey, setExperienceKey] = useState('');
  const [selectedRole, setSelectedRole] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/data/salaryBenchmarks.json');
        if (!res.ok) throw new Error('Could not load salary data.');
        const data = (await res.json()) as SalaryRole[];
        if (cancelled) return;
        setRoles(data);
        if (data.length > 0) {
          const first = data[0];
          const bands = Object.keys(first.bands);
          setExperienceKey(bands[1] ?? bands[0] ?? '');
          setSelectedRole(first.role);
        }
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            const { search: s, experienceKey: ek, selectedRole: sr } = JSON.parse(saved) as {
              search?: string;
              experienceKey?: string;
              selectedRole?: string;
            };
            if (s) setSearch(s);
            if (ek) setExperienceKey(ek);
            if (sr) setSelectedRole(sr);
          }
        } catch { /* ignore */ }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const experienceOptions = useMemo(() => {
    if (roles.length === 0) return [];
    const keys = new Set<string>();
    const labels = new Map<string, string>();
    for (const entry of roles) {
      for (const [key, band] of Object.entries(entry.bands)) {
        keys.add(key);
        labels.set(key, band.label);
      }
    }
    return [...keys].map((key) => ({ key, label: labels.get(key) ?? key }));
  }, [roles]);

  const filteredRoles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return roles.filter((r) => !q || r.role.toLowerCase().includes(q));
  }, [roles, search]);

  const selected = useMemo(
    () => roles.find((r) => r.role === selectedRole) ?? filteredRoles[0] ?? null,
    [roles, selectedRole, filteredRoles]
  );

  const activeBand = selected && experienceKey ? selected.bands[experienceKey] : null;

  const persist = useCallback((patch: { search?: string; experienceKey?: string; selectedRole?: string }) => {
    try {
      const current = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, string>;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
    } catch { /* ignore */ }
  }, []);

  if (loading) {
    return <p className="text-sm text-emerald-200">Loading salary benchmarks…</p>;
  }

  if (error) {
    return <p className="text-sm text-rose-400" role="alert">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-300">Search role</span>
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                persist({ search: e.target.value });
              }}
              placeholder="e.g. Software, Nurse…"
              className="input-field w-full"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-300">Experience level</span>
            <select
              value={experienceKey}
              onChange={(e) => {
                setExperienceKey(e.target.value);
                persist({ experienceKey: e.target.value });
              }}
              className="input-field w-full"
            >
              {experienceOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {selected && activeBand && (
        <section className="rounded-2xl border border-emerald-900/40 bg-gradient-to-br from-emerald-950/30 to-slate-900/60 p-5 shadow-lg">
          <p className="text-lg font-bold text-white">{selected.role}</p>
          <p className="mt-1 text-sm text-slate-400">{activeBand.label} · indicative annual CTC (₹ lakhs)</p>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-2 py-3">
              <p className="text-xs uppercase text-slate-500">Min</p>
              <p className="mt-1 text-xl font-bold text-slate-300">₹{activeBand.min.toFixed(1)}</p>
            </div>
            <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 px-2 py-3">
              <p className="text-xs uppercase text-emerald-500">Mid</p>
              <p className="mt-1 text-xl font-bold text-emerald-400">₹{activeBand.mid.toFixed(1)}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-2 py-3">
              <p className="text-xs uppercase text-slate-500">Max</p>
              <p className="mt-1 text-xl font-bold text-slate-300">₹{activeBand.max.toFixed(1)}</p>
            </div>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">All roles</h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-slate-900/80 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Min (LPA)</th>
                <th className="px-4 py-3">Mid (LPA)</th>
                <th className="px-4 py-3">Max (LPA)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/40">
              {filteredRoles.map((entry) => {
                const band = entry.bands[experienceKey];
                if (!band) return null;
                const isSelected = entry.role === selectedRole;
                return (
                  <tr
                    key={entry.role}
                    className={`cursor-pointer transition hover:bg-emerald-950/30 ${isSelected ? 'bg-emerald-950/40 ring-1 ring-inset ring-emerald-700/50' : ''}`}
                    onClick={() => {
                      setSelectedRole(entry.role);
                      persist({ selectedRole: entry.role });
                    }}
                  >
                    <td className="px-4 py-3 font-medium text-white">{entry.role}</td>
                    <td className="px-4 py-3 text-slate-400">{band.min.toFixed(1)}</td>
                    <td className="px-4 py-3 text-emerald-400">{band.mid.toFixed(1)}</td>
                    <td className="px-4 py-3 text-slate-400">{band.max.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredRoles.length === 0 && (
          <p className="mt-3 text-center text-sm text-slate-500">No roles match your search.</p>
        )}
      </section>
    </div>
  );
}
