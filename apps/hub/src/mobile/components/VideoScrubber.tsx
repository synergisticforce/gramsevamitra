export interface VideoScrubberProps {
  duration: number;
  startTime: number;
  endTime: number;
  onChange: (startTime: number, endTime: number) => void;
  disabled?: boolean;
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function VideoScrubber({
  duration,
  startTime,
  endTime,
  onChange,
  disabled = false,
}: VideoScrubberProps) {
  const safeDuration = Math.max(duration, 0.1);
  const minGap = Math.min(0.5, safeDuration);

  const handleStart = (value: number) => {
    const nextStart = Math.min(value, endTime - minGap);
    onChange(Math.max(0, nextStart), endTime);
  };

  const handleEnd = (value: number) => {
    const nextEnd = Math.max(value, startTime + minGap);
    onChange(startTime, Math.min(safeDuration, nextEnd));
  };

  return (
    <div className="w-full space-y-3 rounded-2xl border border-canvas-border bg-canvas-surface px-4 py-4">
      <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-300">
        <span>Start {formatClock(startTime)}</span>
        <span className="tabular-nums text-canvas-text">
          Clip {formatClock(Math.max(0, endTime - startTime))}
        </span>
        <span>End {formatClock(endTime)}</span>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-300">
          Start thumb
        </span>
        <input
          type="range"
          min={0}
          max={safeDuration}
          step={0.1}
          value={startTime}
          disabled={disabled}
          onChange={(event) => handleStart(Number(event.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-canvas-elevated accent-emerald-500 disabled:opacity-50"
          aria-label="Trim start time"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-300">
          End thumb
        </span>
        <input
          type="range"
          min={0}
          max={safeDuration}
          step={0.1}
          value={endTime}
          disabled={disabled}
          onChange={(event) => handleEnd(Number(event.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-canvas-elevated accent-emerald-500 disabled:opacity-50"
          aria-label="Trim end time"
        />
      </label>
    </div>
  );
}
