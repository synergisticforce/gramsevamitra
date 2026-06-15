interface Props {
  label: string;
  percent: number;
  subtitle?: string;
}

export default function CanvasProcessingOverlay({ label, percent, subtitle }: Props) {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-canvas-accent-muted/40 px-4 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="w-full max-w-sm rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <p className="text-sm font-semibold text-canvas-text">Processing</p>
        <p className="mt-1 text-xs font-medium leading-relaxed text-slate-300">
          {subtitle ?? 'Your file never leaves this device.'}
        </p>
        <p className="mt-3 text-sm font-medium leading-relaxed text-slate-200">{label}</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-canvas-elevated">
          <div
            className="h-full rounded-full bg-canvas-accent-soft0 transition-[width] duration-200"
            style={{ width: `${clamped}%` }}
          />
        </div>
        <p className="mt-2 text-right text-xs font-medium text-canvas-subtle">{clamped}%</p>
      </div>
    </div>
  );
}
