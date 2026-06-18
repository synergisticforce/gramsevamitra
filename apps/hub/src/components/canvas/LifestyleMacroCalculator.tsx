import { useEffect, useMemo, useState } from 'react';
import {
  ACTIVITY_MULTIPLIERS,
  computeBmr,
  computeMacros,
  computeTargetCalories,
  computeTdee,
  GOAL_ADJUSTMENTS,
  type ActivityLevel,
  type FitnessGoal,
  type TdeeSex,
} from '../../lib/lifestyle/tdeeEngine';
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
  sex: TdeeSex;
  age: string;
  weightKg: string;
  heightCm: string;
  activity: ActivityLevel;
  goal: FitnessGoal;
}

const DEFAULTS: FormState = {
  sex: 'male',
  age: '28',
  weightKg: '72',
  heightCm: '175',
  activity: 'moderate',
  goal: 'maintain',
};

function parsePositive(value: string): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function LifestyleMacroCalculator() {
  const initial = useMemo(
    () => loadPersistedJson<FormState>(LIFESTYLE_STORAGE_KEYS.macro, DEFAULTS),
    [],
  );
  const [form, setForm] = useState<FormState>(initial);

  useEffect(() => {
    savePersistedJson(LIFESTYLE_STORAGE_KEYS.macro, form);
  }, [form]);

  const result = useMemo(() => {
    const age = parsePositive(form.age);
    const weight = parsePositive(form.weightKg);
    const height = parsePositive(form.heightCm);
    if (age === null || weight === null || height === null) return null;

    const bmr = computeBmr(form.sex, weight, height, age);
    const tdee = computeTdee(bmr, form.activity);
    const target = computeTargetCalories(tdee, form.goal);
    const macros = computeMacros(target, weight, form.goal);

    return { bmr: Math.round(bmr), tdee: Math.round(tdee), target, macros };
  }, [form]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(['male', 'female'] as const).map((sex) => (
          <button
            key={sex}
            type="button"
            onClick={() => setForm((f) => ({ ...f, sex }))}
            className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize transition ${
              form.sex === sex
                ? 'bg-canvas-accent-muted text-white'
                : 'border border-canvas-border bg-canvas-surface text-slate-200 hover:bg-canvas-elevated'
            }`}
          >
            {sex}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          <span className={LIFESTYLE_LABEL_CLASS}>Age (years)</span>
          <input
            type="number"
            min={14}
            max={100}
            value={form.age}
            onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
            className={LIFESTYLE_INPUT_CLASS}
          />
        </label>
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
            value={form.heightCm}
            onChange={(e) => setForm((f) => ({ ...f, heightCm: e.target.value }))}
            className={LIFESTYLE_INPUT_CLASS}
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className={LIFESTYLE_LABEL_CLASS}>Activity level</span>
        <select
          value={form.activity}
          onChange={(e) => setForm((f) => ({ ...f, activity: e.target.value as ActivityLevel }))}
          className={LIFESTYLE_INPUT_CLASS}
        >
          {(Object.keys(ACTIVITY_MULTIPLIERS) as ActivityLevel[]).map((key) => (
            <option key={key} value={key}>
              {ACTIVITY_MULTIPLIERS[key].label}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(GOAL_ADJUSTMENTS) as FitnessGoal[]).map((goal) => (
          <button
            key={goal}
            type="button"
            onClick={() => setForm((f) => ({ ...f, goal }))}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              form.goal === goal
                ? 'bg-canvas-accent-muted text-white'
                : 'border border-canvas-border bg-canvas-surface text-slate-200 hover:bg-canvas-elevated'
            }`}
          >
            {GOAL_ADJUSTMENTS[goal].label}
          </button>
        ))}
      </div>

      {result ? (
        <div className={`${LIFESTYLE_RESULT_PANEL_CLASS} space-y-4`}>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium text-slate-300">BMR</p>
              <p className="text-lg font-bold text-white tabular-nums">{result.bmr} kcal</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-300">TDEE (maintenance)</p>
              <p className="text-lg font-bold text-white tabular-nums">{result.tdee} kcal</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-300">Target ({form.goal})</p>
              <p className="text-lg font-bold text-canvas-accent tabular-nums">{result.target} kcal</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-canvas-elevated px-3 py-2">
              <p className="text-xs font-medium text-slate-300">Protein</p>
              <p className="text-base font-bold text-white">{result.macros.proteinG} g</p>
              <p className="text-xs text-slate-300">{result.macros.proteinKcal} kcal</p>
            </div>
            <div className="rounded-lg bg-canvas-elevated px-3 py-2">
              <p className="text-xs font-medium text-slate-300">Carbs</p>
              <p className="text-base font-bold text-white">{result.macros.carbsG} g</p>
              <p className="text-xs text-slate-300">{result.macros.carbsKcal} kcal</p>
            </div>
            <div className="rounded-lg bg-canvas-elevated px-3 py-2">
              <p className="text-xs font-medium text-slate-300">Fat</p>
              <p className="text-base font-bold text-white">{result.macros.fatG} g</p>
              <p className="text-xs text-slate-300">{result.macros.fatKcal} kcal</p>
            </div>
          </div>

          <p className="text-xs font-medium leading-relaxed text-slate-300">
            Mifflin–St Jeor BMR · protein prioritized by body weight · fat ≈ 25% of target calories.
            For medical conditions, consult a registered dietitian.
          </p>
        </div>
      ) : (
        <p className="text-sm font-medium text-slate-200">Enter age, weight, and height to calculate TDEE and macros.</p>
      )}
    </div>
  );
}
