import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BENCHMARK_ROLES,
  DEFAULT_SALARY_BENCHMARK_PREFS,
  EXPERIENCE_OPTIONS,
  formatLpa,
  loadSalaryBenchmarkPrefs,
  lookupRegionalBenchmark,
  REGION_OPTIONS,
  saveSalaryBenchmarkPrefs,
  type ExperienceTier,
  type RegionTier,
} from '../../lib/canvas/careerSalaryBenchmark';

export default function FinanceSalaryBenchmark() {
  const [roleId, setRoleId] = useState(DEFAULT_SALARY_BENCHMARK_PREFS.roleId);
  const [experience, setExperience] = useState<ExperienceTier>(DEFAULT_SALARY_BENCHMARK_PREFS.experience);
  const [region, setRegion] = useState<RegionTier>(DEFAULT_SALARY_BENCHMARK_PREFS.region);

  useEffect(() => {
    const saved = loadSalaryBenchmarkPrefs();
    setRoleId(saved.roleId);
    setExperience(saved.experience);
    setRegion(saved.region);
  }, []);

  const persist = useCallback(
    (patch: Partial<{ roleId: string; experience: ExperienceTier; region: RegionTier }>) => {
      const next = {
        roleId: patch.roleId ?? roleId,
        experience: patch.experience ?? experience,
        region: patch.region ?? region,
      };
      saveSalaryBenchmarkPrefs(next);
    },
    [experience, region, roleId],
  );

  const result = useMemo(
    () => lookupRegionalBenchmark(roleId, experience, region),
    [roleId, experience, region],
  );

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">Role</span>
        <select
          value={roleId}
          onChange={(event) => {
            setRoleId(event.target.value);
            persist({ roleId: event.target.value });
          }}
          className="mt-1.5 w-full rounded-xl border border-canvas-border bg-canvas-surface px-3 py-2.5 text-sm text-slate-200"
        >
          {BENCHMARK_ROLES.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.role}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
          Experience tier
        </span>
        <select
          value={experience}
          onChange={(event) => {
            const value = event.target.value as ExperienceTier;
            setExperience(value);
            persist({ experience: value });
          }}
          className="mt-1.5 w-full rounded-xl border border-canvas-border bg-canvas-surface px-3 py-2.5 text-sm text-slate-200"
        >
          {EXPERIENCE_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
          Geographic region
        </span>
        <select
          value={region}
          onChange={(event) => {
            const value = event.target.value as RegionTier;
            setRegion(value);
            persist({ region: value });
          }}
          className="mt-1.5 w-full rounded-xl border border-canvas-border bg-canvas-surface px-3 py-2.5 text-sm text-slate-200"
        >
          {REGION_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-slate-300">
          {REGION_OPTIONS.find((r) => r.id === region)?.cities}
        </p>
      </label>

      {result && (
        <div className="rounded-xl border border-canvas-border bg-canvas-elevated p-4">
          <p className="text-sm font-bold text-canvas-text">{result.role}</p>
          <p className="mt-0.5 text-xs text-slate-300">
            {result.experienceLabel} · {result.regionLabel}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-canvas-border bg-canvas-surface px-2 py-3">
              <p className="text-[10px] uppercase text-slate-300">Min</p>
              <p className="mt-1 text-base font-bold text-slate-200">{formatLpa(result.min)}</p>
            </div>
            <div className="rounded-lg border border-emerald-500/40 bg-canvas-surface px-2 py-3">
              <p className="text-[10px] uppercase text-emerald-300">Mid</p>
              <p className="mt-1 text-base font-bold text-emerald-200">{formatLpa(result.mid)}</p>
            </div>
            <div className="rounded-lg border border-canvas-border bg-canvas-surface px-2 py-3">
              <p className="text-[10px] uppercase text-slate-300">Max</p>
              <p className="mt-1 text-base font-bold text-slate-200">{formatLpa(result.max)}</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-slate-300">
            Indicative annual CTC (₹ lakhs). Actual offers vary by company, skills, and negotiation.
          </p>
        </div>
      )}
    </div>
  );
}
