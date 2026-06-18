import { useEffect, useMemo, useState } from 'react';
import {
  BMI_CATEGORY_META,
  classifyBmi,
  computeBmi,
  computeBmiImperial,
  feetInchesToCm,
  feetInchesToInches,
  type BmiUnitSystem,
} from '../../lib/lifestyle/bmiEngine';
import {
  LIFESTYLE_INPUT_CLASS,
  LIFESTYLE_LABEL_CLASS,
  LIFESTYLE_RESULT_PANEL_CLASS,
} from '../../lib/lifestyle/lifestyleUi';
import {
  LIFESTYLE_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/lifestyleCanvasStorage';

interface FormState {
  unit: BmiUnitSystem;
  weightKg: string;
  heightCm: string;
  weightLbs: string;
  heightFt: string;
  heightIn: string;
}

const DEFAULTS: FormState = {
  unit: 'metric',
  weightKg: '70',
  heightCm: '170',
  weightLbs: '154',
  heightFt: '5',
  heightIn: '7',
};

function parsePositive(value: string): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function LifestyleBmiCalculator() {
  const initial = useMemo(
    () => loadPersistedJson<FormState>(LIFESTYLE_STORAGE_KEYS.bmi, DEFAULTS),
    [],
  );
  const [form, setForm] = useState<FormState>(initial);

  useEffect(() => {
    savePersistedJson(LIFESTYLE_STORAGE_KEYS.bmi, form);
  }, [form]);

  const result = useMemo(() => {
    let bmi: number;
    if (form.unit === 'metric') {
      const w = parsePositive(form.weightKg);
      const h = parsePositive(form.heightCm);
      if (w === null || h === null) return null;
      bmi = computeBmi(w, h);
    } else {
      const w = parsePositive(form.weightLbs);
      const ft = parsePositive(form.heightFt) ?? 0;
      const inches = parsePositive(form.heightIn) ?? 0;
      const totalIn = feetInchesToInches(ft, inches);
      if (w === null || totalIn <= 0) return null;
      bmi = computeBmiImperial(w, totalIn);
    }
    if (!Number.isFinite(bmi)) return null;
    const category = classifyBmi(bmi);
    return { bmi, category, meta: BMI_CATEGORY_META[category] };
  }, [form]);

  const barPosition = result
    ? Math.min(100, Math.max(0, ((result.bmi - 15) / (40 - 15)) * 100))
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(['metric', 'imperial'] as const).map((unit) => (
          <button
            key={unit}
            type="button"
            onClick={() => setForm((f) => ({ ...f, unit }))}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              form.unit === unit
                ? 'bg-canvas-accent-muted text-white'
                : 'border border-canvas-border bg-canvas-surface text-slate-200 hover:bg-canvas-elevated'
            }`}
          >
            {unit === 'metric' ? 'Metric (kg / cm)' : 'Imperial (lb / ft·in)'}
          </button>
        ))}
      </div>

      {form.unit === 'metric' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className={LIFESTYLE_LABEL_CLASS}>Weight (kg)</span>
            <input
              type="number"
              min={1}
              step="0.1"
              value={form.weightKg}
              onChange={(e) => setForm((f) => ({ ...f, weightKg: e.target.value }))}
              className={LIFESTYLE_INPUT_CLASS}
            />
          </label>
          <label className="block text-sm">
            <span className={LIFESTYLE_LABEL_CLASS}>Height (cm)</span>
            <input
              type="number"
              min={1}
              step="0.1"
              value={form.heightCm}
              onChange={(e) => setForm((f) => ({ ...f, heightCm: e.target.value }))}
              className={LIFESTYLE_INPUT_CLASS}
            />
          </label>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            <span className={LIFESTYLE_LABEL_CLASS}>Weight (lb)</span>
            <input
              type="number"
              min={1}
              value={form.weightLbs}
              onChange={(e) => setForm((f) => ({ ...f, weightLbs: e.target.value }))}
              className={LIFESTYLE_INPUT_CLASS}
            />
          </label>
          <label className="block text-sm">
            <span className={LIFESTYLE_LABEL_CLASS}>Height (ft)</span>
            <input
              type="number"
              min={0}
              value={form.heightFt}
              onChange={(e) => setForm((f) => ({ ...f, heightFt: e.target.value }))}
              className={LIFESTYLE_INPUT_CLASS}
            />
          </label>
          <label className="block text-sm">
            <span className={LIFESTYLE_LABEL_CLASS}>Height (in)</span>
            <input
              type="number"
              min={0}
              max={11}
              value={form.heightIn}
              onChange={(e) => setForm((f) => ({ ...f, heightIn: e.target.value }))}
              className={LIFESTYLE_INPUT_CLASS}
            />
          </label>
        </div>
      )}

      {result ? (
        <div className={`${LIFESTYLE_RESULT_PANEL_CLASS} space-y-4`}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-canvas-accent">Your BMI</p>
              <p className="mt-1 text-3xl font-bold text-white tabular-nums">{result.bmi.toFixed(1)}</p>
            </div>
            <span className="rounded-lg bg-canvas-elevated px-3 py-1 text-sm font-semibold text-slate-200">
              {result.meta.label} · {result.meta.range}
            </span>
          </div>

          <div className="relative h-3 overflow-hidden rounded-full bg-canvas-elevated">
            <div
              className={`absolute left-0 top-0 h-full ${result.meta.barColor} transition-all`}
              style={{ width: `${barPosition}%` }}
            />
            <div className="absolute inset-0 flex">
              <div className="flex-1 border-r border-canvas-border/40" />
              <div className="flex-1 border-r border-canvas-border/40" />
              <div className="flex-1 border-r border-canvas-border/40" />
              <div className="flex-1" />
            </div>
          </div>
          <div className="flex justify-between text-[10px] font-medium text-slate-300">
            <span>15</span>
            <span>18.5</span>
            <span>25</span>
            <span>30</span>
            <span>40+</span>
          </div>

          <p className="text-sm font-medium leading-relaxed text-slate-200">{result.meta.description}</p>
          {form.unit === 'imperial' && (
            <p className="text-xs text-slate-300">
              Equivalent height:{' '}
              {feetInchesToCm(
                parsePositive(form.heightFt) ?? 0,
                parsePositive(form.heightIn) ?? 0,
              ).toFixed(1)}{' '}
              cm
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm font-medium text-slate-200">Enter valid height and weight to calculate BMI.</p>
      )}
    </div>
  );
}
