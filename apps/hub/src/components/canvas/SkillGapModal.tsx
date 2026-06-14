import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  computeSkillGapStats,
  loadSkillGapProgress,
  saveSkillGapProgress,
  TARGET_ROLE_PROFILES,
} from '../../lib/canvas/careerSkillGap';

interface Props {
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export default function SkillGapModal({ onClose, onSuccess }: Props) {
  const [roleId, setRoleId] = useState(TARGET_ROLE_PROFILES[0].id);
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  useEffect(() => {
    const saved = loadSkillGapProgress();
    setRoleId(saved.roleId);
    setCompletedIds(saved.completedIds);
  }, []);

  const profile = useMemo(
    () => TARGET_ROLE_PROFILES.find((r) => r.id === roleId) ?? TARGET_ROLE_PROFILES[0],
    [roleId]
  );

  const stats = useMemo(
    () => computeSkillGapStats(roleId, completedIds),
    [roleId, completedIds]
  );

  const persist = useCallback((nextRoleId: string, nextCompleted: string[]) => {
    saveSkillGapProgress({ roleId: nextRoleId, completedIds: nextCompleted });
  }, []);

  const toggleCompetency = useCallback(
    (competencyId: string) => {
      setCompletedIds((prev) => {
        const next = prev.includes(competencyId)
          ? prev.filter((id) => id !== competencyId)
          : [...prev, competencyId];
        persist(roleId, next);
        return next;
      });
    },
    [persist, roleId]
  );

  const handleRoleChange = useCallback(
    (nextRoleId: string) => {
      setRoleId(nextRoleId);
      const saved = loadSkillGapProgress();
      const ids = saved.roleId === nextRoleId ? saved.completedIds : [];
      setCompletedIds(ids);
      persist(nextRoleId, ids);
    },
    [persist]
  );

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="skill-gap-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="skill-gap-title" className="text-lg font-bold text-slate-900">
              🎯 Skill Gap Analyzer
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Core competencies vs. learning resources — progress saved locally.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Target role
          </span>
          <select
            value={roleId}
            onChange={(event) => handleRoleChange(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          >
            {TARGET_ROLE_PROFILES.map((role) => (
              <option key={role.id} value={role.id}>
                {role.label}
              </option>
            ))}
          </select>
        </label>

        <p className="mt-3 text-sm text-slate-600">{profile.summary}</p>

        <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-sky-900">Progress</p>
            <p className="text-sm font-bold text-sky-800">
              {stats.completed}/{stats.total} ({stats.percent}%)
            </p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-sky-100">
            <div
              className="h-full rounded-full bg-sky-600 transition-all"
              style={{ width: `${stats.percent}%` }}
            />
          </div>
        </div>

        <ul className="mt-4 space-y-2">
          {profile.competencies.map((item) => {
            const done = completedIds.includes(item.id);
            return (
              <li
                key={item.id}
                className={`rounded-xl border px-3 py-3 transition ${
                  done ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => toggleCompetency(item.id)}
                    className="mt-1 rounded accent-sky-600"
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-sm font-semibold ${done ? 'text-emerald-900 line-through opacity-80' : 'text-slate-900'}`}
                    >
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      Resource: {item.resource}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => {
              onSuccess(
                `${profile.label}: ${stats.completed}/${stats.total} competencies tracked (${stats.percent}%).`
              );
              onClose();
            }}
            className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
