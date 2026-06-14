interface Props {
  label: string;
  percent: number;
  subtitle?: string;
}

export default function CanvasProcessingOverlay({ label, percent, subtitle }: Props) {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <p className="text-sm font-semibold text-slate-900">Processing</p>
        <p className="mt-1 text-xs text-slate-500">
          {subtitle ?? 'Your file never leaves this device.'}
        </p>
        <p className="mt-3 text-sm text-slate-700">{label}</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width] duration-200"
            style={{ width: `${clamped}%` }}
          />
        </div>
        <p className="mt-2 text-right text-xs font-medium text-slate-500">{clamped}%</p>
      </div>
    </div>
  );
}
