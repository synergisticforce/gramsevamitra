import { useMemo, useState } from 'react';

type Gender = 'male' | 'female';
type WeightUnit = 'kg' | 'lbs';
type HeightUnit = 'cm' | 'in';
type Goal = 'cut' | 'maintain' | 'bulk';

const ACTIVITY = [
  { id: 'sedentary', label: 'Sedentary (little exercise)', factor: 1.2 },
  { id: 'light', label: 'Light (1–3 days/week)', factor: 1.375 },
  { id: 'moderate', label: 'Moderate (3–5 days/week)', factor: 1.55 },
  { id: 'active', label: 'Active (6–7 days/week)', factor: 1.725 },
  { id: 'very', label: 'Very active (athlete)', factor: 1.9 },
] as const;

function toKg(weight: number, unit: WeightUnit): number {
  return unit === 'kg' ? weight : weight * 0.453592;
}

function toCm(height: number, unit: HeightUnit): number {
  return unit === 'cm' ? height : height * 2.54;
}

export default function MacroCalculatorTool() {
  const [age, setAge] = useState('30');
  const [gender, setGender] = useState<Gender>('male');
  const [weight, setWeight] = useState('70');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [height, setHeight] = useState('175');
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('cm');
  const [activity, setActivity] = useState<(typeof ACTIVITY)[number]['id']>('moderate');
  const [goal, setGoal] = useState<Goal>('maintain');

  const result = useMemo(() => {
    const ageN = Number(age);
    const weightN = Number(weight);
    const heightN = Number(height);
    if (!ageN || !weightN || !heightN || ageN < 10 || ageN > 100) return null;

    const kg = toKg(weightN, weightUnit);
    const cm = toCm(heightN, heightUnit);
    const bmr =
      gender === 'male'
        ? 10 * kg + 6.25 * cm - 5 * ageN + 5
        : 10 * kg + 6.25 * cm - 5 * ageN - 161;

    const activityFactor = ACTIVITY.find((a) => a.id === activity)?.factor ?? 1.55;
    let tdee = bmr * activityFactor;
    if (goal === 'cut') tdee -= 500;
    if (goal === 'bulk') tdee += 300;

    const calories = Math.round(tdee);
    const proteinG = Math.round(kg * 2.2);
    const fatG = Math.round((calories * 0.25) / 9);
    const proteinCal = proteinG * 4;
    const fatCal = fatG * 9;
    const carbG = Math.max(0, Math.round((calories - proteinCal - fatCal) / 4));

    return { calories, proteinG, fatG, carbG, bmr: Math.round(bmr) };
  }, [age, gender, weight, weightUnit, height, heightUnit, activity, goal]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-2xl border border-slate-800 bg-canvas-accent-muted/60 p-5">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-canvas-muted">Age</span>
          <input
            type="number"
            min={10}
            max={100}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="input-field w-full tabular-nums"
          />
        </label>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-canvas-muted">Gender</legend>
          <div className="flex gap-2">
            {(['male', 'female'] as Gender[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(g)}
                className={`flex-1 rounded-xl border py-2 text-sm font-semibold capitalize ${
                  gender === g
                    ? 'border-canvas-accent bg-canvas-accent-soft/50 text-canvas-accent'
                    : 'border-canvas-border text-canvas-subtle'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-canvas-muted">Weight</span>
            <input
              type="number"
              min={1}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="input-field w-full tabular-nums"
            />
          </label>
          <div className="flex flex-col justify-end gap-1">
            {(['kg', 'lbs'] as WeightUnit[]).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setWeightUnit(u)}
                className={`rounded-lg border px-3 py-1 text-xs font-semibold uppercase ${
                  weightUnit === u ? 'border-canvas-accent text-canvas-accent' : 'border-canvas-border text-canvas-subtle'
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-canvas-muted">Height</span>
            <input
              type="number"
              min={1}
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="input-field w-full tabular-nums"
            />
          </label>
          <div className="flex flex-col justify-end gap-1">
            {(['cm', 'in'] as HeightUnit[]).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setHeightUnit(u)}
                className={`rounded-lg border px-3 py-1 text-xs font-semibold uppercase ${
                  heightUnit === u ? 'border-canvas-accent text-canvas-accent' : 'border-canvas-border text-canvas-subtle'
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-canvas-muted">Activity level</span>
          <select
            value={activity}
            onChange={(e) => setActivity(e.target.value as (typeof ACTIVITY)[number]['id'])}
            className="input-field w-full"
          >
            {ACTIVITY.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-canvas-muted">Goal</legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'cut', label: 'Cut' },
                { id: 'maintain', label: 'Maintain' },
                { id: 'bulk', label: 'Bulk' },
              ] as { id: Goal; label: string }[]
            ).map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGoal(g.id)}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                  goal === g.id
                    ? 'border-canvas-accent bg-canvas-accent-soft/50 text-canvas-accent'
                    : 'border-canvas-border text-canvas-subtle'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-canvas-border bg-canvas-accent-soft/30 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-canvas-accent/80">Daily calories</p>
          <p className="mt-2 text-4xl font-extrabold tabular-nums text-canvas-text">
            {result ? result.calories.toLocaleString() : '—'}
          </p>
          {result && <p className="mt-1 text-sm font-medium leading-relaxed text-slate-200">BMR: {result.bmr.toLocaleString()} kcal</p>}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Protein', value: result?.proteinG, unit: 'g', hint: '2.2 g/kg' },
            { label: 'Fat', value: result?.fatG, unit: 'g', hint: '25% of cals' },
            { label: 'Carbs', value: result?.carbG, unit: 'g', hint: 'remainder' },
          ].map((m) => (
            <div
              key={m.label}
              className="rounded-2xl border border-slate-800 bg-canvas-accent-muted/60 p-4 text-center"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-canvas-subtle">{m.label}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-canvas-text">
                {m.value ?? '—'}
                <span className="ml-0.5 text-sm font-medium text-canvas-subtle">{m.unit}</span>
              </p>
              <p className="mt-1 text-xs font-medium leading-relaxed text-slate-300">{m.hint}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
