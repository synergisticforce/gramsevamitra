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

interface Props {
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export default function SalaryBenchmarkModal({ onClose, onSuccess }: Props) {
  const [roleId, setRoleId] = useState(DEFAULT_SALARY_BENCHMARK_PREFS.roleId);
  const [experience, setExperience] = useState<ExperienceTier>(DEFAULT_SALARY_BENCHMARK_PREFS.experience);
  const [region, setRegion] = useState<RegionTier>(DEFAULT_SALARY_BENCHMARK_PREFS.region);

  useEffect(() => {
    const saved = loadSalaryBenchmarkPrefs();
    setRoleId(saved.roleId);
    setExperience(saved.experience);
    setRegion(saved.region);
  }, []);

  const persist = useCallback((patch: Partial<{ roleId: string; experience: ExperienceTier; region: RegionTier }>) => {
    const next = {
      roleId: patch.roleId ?? roleId,
      experience: patch.experience ?? experience,
      region: patch.region ?? region,
    };
    saveSalaryBenchmarkPrefs(next);
  }, [experience, region, roleId]);

  const result = useMemo(
    () => lookupRegionalBenchmark(roleId, experience, region),
    [roleId, experience, region]
  );

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="salary-benchmark-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="salary-benchmark-title" className="text-lg font-bold text-canvas-text">
              📊 Salary Benchmarking
            </h2>
            <p className="mt-1 text-sm font-medium leading-relaxed text-slate-200">
              Indicative CTC ranges by role, experience, and region — offline static data.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-canvas-subtle transition hover:bg-canvas-elevated hover:text-canvas-muted"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">Role</span>
            <select
              value={roleId}
              onChange={(event) => {
                setRoleId(event.target.value);
                persist({ roleId: event.target.value });
              }}
              className="mt-1.5 w-full rounded-xl border border-canvas-border px-3 py-2.5 text-sm"
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
              className="mt-1.5 w-full rounded-xl border border-canvas-border px-3 py-2.5 text-sm"
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
              className="mt-1.5 w-full rounded-xl border border-canvas-border px-3 py-2.5 text-sm"
            >
              {REGION_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-canvas-subtle">
              {REGION_OPTIONS.find((r) => r.id === region)?.cities}
            </p>
          </label>
        </div>

        {result && (
          <div className="mt-5 rounded-xl border border-canvas-border bg-canvas-elevated p-4">
            <p className="text-sm font-bold text-sky-900">{result.role}</p>
            <p className="mt-0.5 text-xs text-sky-700">
              {result.experienceLabel} · {result.regionLabel}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-sky-100 bg-canvas-surface px-2 py-3">
                <p className="text-[10px] uppercase text-canvas-subtle">Min</p>
                <p className="mt-1 text-base font-bold text-canvas-muted">{formatLpa(result.min)}</p>
              </div>
              <div className="rounded-lg border border-sky-300 bg-canvas-surface px-2 py-3">
                <p className="text-[10px] uppercase text-sky-600">Mid</p>
                <p className="mt-1 text-base font-bold text-sky-800">{formatLpa(result.mid)}</p>
              </div>
              <div className="rounded-lg border border-sky-100 bg-canvas-surface px-2 py-3">
                <p className="text-[10px] uppercase text-canvas-subtle">Max</p>
                <p className="mt-1 text-base font-bold text-canvas-muted">{formatLpa(result.max)}</p>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-sky-700">
              Indicative annual CTC (₹ lakhs). Actual offers vary by company, skills, and negotiation.
            </p>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => {
              if (result) {
                onSuccess(
                  `${result.role} benchmark: ${formatLpa(result.mid)} mid (${result.regionLabel}).`
                );
              }
              onClose();
            }}
            className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-sky-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
