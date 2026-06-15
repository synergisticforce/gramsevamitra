import { useEffect, useState } from 'react';

interface Props {
  active: boolean;
  stages: string[];
  /** Interval between stage transitions while active */
  intervalMs?: number;
}

export default function ProTaskLoader({ active, stages, intervalMs = 2400 }: Props) {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setStageIndex(0);
      return;
    }

    setStageIndex(0);
    const timer = window.setInterval(() => {
      setStageIndex((prev) => (prev + 1) % stages.length);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [active, stages, intervalMs]);

  if (!active) return null;

  const progress = ((stageIndex + 1) / stages.length) * 100;
  const label = stages[stageIndex] ?? stages[0];

  return (
    <div
      className="rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-3">
        <div
          className="h-10 w-10 shrink-0 animate-pulse rounded-full border-2 border-emerald-200 bg-canvas-accent-soft"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-canvas-accent">Pro AI Pipeline</p>
          <p className="mt-0.5 text-sm font-medium text-canvas-text">{label}</p>
        </div>
        <span className="text-lg" aria-hidden="true">
          ⚡
        </span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-canvas-elevated">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-700 ease-out"
          style={{ width: `${Math.min(progress, 96)}%` }}
        />
      </div>

      <ul className="mt-4 space-y-1.5">
        {stages.map((stage, index) => {
          const done = index < stageIndex;
          const current = index === stageIndex;
          return (
            <li
              key={stage}
              className={`flex items-center gap-2 text-xs ${
                current ? 'font-semibold text-canvas-text' : done ? 'text-canvas-accent' : 'text-canvas-subtle'
              }`}
            >
              <span aria-hidden="true">{done ? '✓' : current ? '●' : '○'}</span>
              {stage}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
