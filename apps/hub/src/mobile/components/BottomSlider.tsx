export interface BottomSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
}

export default function BottomSlider({ label, value, min, max, onChange }: BottomSliderProps) {
  return (
    <label className="block w-full">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">{label}</span>
        <span className="tabular-nums text-xs font-semibold text-canvas-text">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-canvas-elevated accent-emerald-500"
        aria-label={label}
      />
    </label>
  );
}
