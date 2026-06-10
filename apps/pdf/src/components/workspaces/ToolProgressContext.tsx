import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export interface ToolProgressState {
  active: boolean;
  percent: number;
  label: string;
}

interface ToolProgressContextValue {
  progress: ToolProgressState;
  setProgress: (update: Partial<ToolProgressState>) => void;
  resetProgress: () => void;
  report: (current: number, total: number, label: string) => void;
}

const defaultState: ToolProgressState = { active: false, percent: 0, label: '' };

const ToolProgressContext = createContext<ToolProgressContextValue | null>(null);

export function ToolProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgressState] = useState<ToolProgressState>(defaultState);

  const setProgress = useCallback((update: Partial<ToolProgressState>) => {
    setProgressState((prev) => ({ ...prev, ...update }));
  }, []);

  const resetProgress = useCallback(() => setProgressState(defaultState), []);

  const report = useCallback((current: number, total: number, label: string) => {
    const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
    setProgressState({ active: true, percent, label });
  }, []);

  const value = useMemo(
    () => ({ progress, setProgress, resetProgress, report }),
    [progress, setProgress, resetProgress, report]
  );

  return <ToolProgressContext.Provider value={value}>{children}</ToolProgressContext.Provider>;
}

export function useToolProgress() {
  const ctx = useContext(ToolProgressContext);
  if (!ctx) {
    return {
      progress: defaultState,
      setProgress: () => {},
      resetProgress: () => {},
      report: () => {},
    };
  }
  return ctx;
}

export function ToolProgressLoader() {
  const { progress } = useToolProgress();
  if (!progress.active) return null;

  return (
    <div
      className="mb-4 rounded-xl border border-emerald-700/50 bg-[#064e3b]/40 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      role="status"
      aria-live="polite"
    >
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-emerald-100">{progress.label}</span>
        <span className="font-bold tabular-nums text-[#10b981]">{progress.percent}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-[#10b981] transition-all duration-300 ease-out"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
    </div>
  );
}
