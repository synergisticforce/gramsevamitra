import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  QUICK_TOOLS_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/quickToolsCanvasStorage';
import { playTimerAlert } from '../../lib/quick/quickToolEngines';

type PomodoroPhase = 'focus' | 'break';

interface FormState {
  focusMin: number;
  breakMin: number;
}

const DEFAULTS: FormState = { focusMin: 25, breakMin: 5 };

function formatClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function QuickPomodoroTimer() {
  const initial = useMemo(
    () => loadPersistedJson<FormState>(QUICK_TOOLS_STORAGE_KEYS.pomodoro, DEFAULTS),
    [],
  );
  const [focusMin, setFocusMin] = useState(initial.focusMin);
  const [breakMin, setBreakMin] = useState(initial.breakMin);
  const [phase, setPhase] = useState<PomodoroPhase>('focus');
  const [secondsLeft, setSecondsLeft] = useState(initial.focusMin * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const phaseRef = useRef(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const totalSeconds = (phase === 'focus' ? focusMin : breakMin) * 60;
  const progress = totalSeconds > 0 ? 1 - secondsLeft / totalSeconds : 0;

  const switchPhase = useCallback(
    (next: PomodoroPhase) => {
      setPhase(next);
      setSecondsLeft((next === 'focus' ? focusMin : breakMin) * 60);
    },
    [breakMin, focusMin],
  );

  useEffect(() => {
    if (!running) return;

    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev > 1) return prev - 1;

        playTimerAlert();
        if (phaseRef.current === 'focus') {
          setSessions((s) => s + 1);
          setPhase('break');
          return breakMin * 60;
        }
        setPhase('focus');
        return focusMin * 60;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [running, switchPhase]);

  useEffect(() => {
    savePersistedJson(QUICK_TOOLS_STORAGE_KEYS.pomodoro, { focusMin, breakMin });
  }, [breakMin, focusMin]);

  const inputClass =
    'w-full rounded-xl border border-canvas-border bg-canvas-surface px-3 py-2.5 text-sm text-white outline-none ring-violet-500/30 focus:border-violet-400 focus:ring-2 tabular-nums';

  const stop = () => {
    setRunning(false);
    setPhase('focus');
    setSecondsLeft(focusMin * 60);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-200">Focus (minutes)</span>
          <input
            type="number"
            min={1}
            max={120}
            value={focusMin}
            disabled={running}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n > 0) {
                setFocusMin(n);
                if (!running && phase === 'focus') setSecondsLeft(n * 60);
              }
            }}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-200">Break (minutes)</span>
          <input
            type="number"
            min={1}
            max={60}
            value={breakMin}
            disabled={running}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n > 0) {
                setBreakMin(n);
                if (!running && phase === 'break') setSecondsLeft(n * 60);
              }
            }}
            className={inputClass}
          />
        </label>
      </div>

      <div className="relative mx-auto flex h-48 w-48 items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" className="text-canvas-elevated" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="currentColor"
            className={phase === 'break' ? 'text-emerald-400' : 'text-violet-400'}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 44}`}
            strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress)}`}
          />
        </svg>
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            {running ? (phase === 'focus' ? 'Focus' : 'Break') : 'Ready'}
          </p>
          <p className="mt-1 text-4xl font-bold text-white tabular-nums">{formatClock(secondsLeft)}</p>
          <p className="mt-1 text-xs text-slate-300">{sessions} session{sessions === 1 ? '' : 's'} completed</p>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {!running ? (
          <button
            type="button"
            onClick={() => setRunning(true)}
            className="rounded-xl bg-canvas-accent-muted px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-canvas-accent/40"
          >
            {secondsLeft === focusMin * 60 && phase === 'focus' ? 'Start focus' : 'Resume'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setRunning(false)}
            className="rounded-xl border border-canvas-border bg-canvas-surface px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-canvas-elevated"
          >
            Pause
          </button>
        )}
        <button
          type="button"
          onClick={stop}
          className="rounded-xl border border-canvas-border bg-canvas-surface px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-canvas-elevated"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => switchPhase(phase === 'focus' ? 'break' : 'focus')}
          className="rounded-xl border border-canvas-border bg-canvas-surface px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-canvas-elevated"
        >
          Switch to {phase === 'focus' ? 'break' : 'focus'}
        </button>
      </div>

      <p className="text-center text-xs font-medium text-slate-300">
        Audio alert plays when a focus or break session ends (browser Web Audio API).
      </p>
    </div>
  );
}
