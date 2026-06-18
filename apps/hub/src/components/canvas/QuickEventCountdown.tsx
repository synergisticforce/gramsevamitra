import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  QUICK_TOOLS_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/quickToolsCanvasStorage';
import { pad2, playTimerAlert, splitCountdown } from '../../lib/quick/quickToolEngines';

interface FormState {
  label: string;
  target: string;
}

const DEFAULTS: FormState = {
  label: 'UPSC Prelims',
  target: '',
};

export default function QuickEventCountdown() {
  const initial = useMemo(
    () => loadPersistedJson<FormState>(QUICK_TOOLS_STORAGE_KEYS.eventCountdown, DEFAULTS),
    [],
  );
  const [label, setLabel] = useState(initial.label);
  const [target, setTarget] = useState(initial.target);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    savePersistedJson(QUICK_TOOLS_STORAGE_KEYS.eventCountdown, { label, target });
  }, [label, target]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const targetMs = useMemo(() => {
    if (!target) return null;
    const ms = new Date(target).getTime();
    return Number.isFinite(ms) ? ms : null;
  }, [target]);

  const countdown = useMemo(() => {
    if (targetMs === null) return null;
    return splitCountdown(targetMs, now);
  }, [now, targetMs]);

  const inputClass =
    'w-full rounded-xl border border-canvas-border bg-canvas-surface px-3 py-2.5 text-sm text-white outline-none ring-violet-500/30 focus:border-violet-400 focus:ring-2';

  const setQuickTarget = useCallback((daysFromNow: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    d.setHours(9, 0, 0, 0);
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    setTarget(iso);
  }, []);

  return (
    <div className="space-y-6">
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-200">Event label</span>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className={inputClass}
          placeholder="Exam, deadline, interview…"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-200">Target date & time</span>
        <input
          type="datetime-local"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className={inputClass}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setQuickTarget(7)}
          className="rounded-xl border border-canvas-border bg-canvas-surface px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-canvas-elevated"
        >
          +7 days
        </button>
        <button
          type="button"
          onClick={() => setQuickTarget(30)}
          className="rounded-xl border border-canvas-border bg-canvas-surface px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-canvas-elevated"
        >
          +30 days
        </button>
        <button
          type="button"
          onClick={() => setQuickTarget(90)}
          className="rounded-xl border border-canvas-border bg-canvas-surface px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-canvas-elevated"
        >
          +90 days
        </button>
      </div>

      {countdown ? (
        <div className="rounded-xl border border-canvas-border bg-canvas-surface p-5 text-center">
          <p className="text-sm font-semibold text-slate-200">{label || 'Countdown'}</p>
          {countdown.expired ? (
            <p className="mt-4 text-2xl font-bold text-rose-300">Event time has passed</p>
          ) : (
            <div className="mt-4 grid grid-cols-4 gap-2 sm:gap-4">
              {(
                [
                  ['Days', countdown.days],
                  ['Hours', countdown.hours],
                  ['Minutes', countdown.minutes],
                  ['Seconds', countdown.seconds],
                ] as const
              ).map(([unit, value]) => (
                <div key={unit} className="rounded-lg bg-canvas-elevated px-2 py-3 sm:px-3">
                  <p className="text-2xl font-bold text-white tabular-nums sm:text-3xl">{pad2(value)}</p>
                  <p className="mt-1 text-xs font-medium text-slate-300">{unit}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm font-medium text-slate-200">Pick a target date and time to start the live countdown.</p>
      )}
    </div>
  );
}
