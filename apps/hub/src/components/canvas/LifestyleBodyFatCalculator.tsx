import { useEffect, useMemo, useState } from 'react';
import {
  bodyFatCategory,
  computeNavyBodyFatPercent,
  type BodyFatSex,
} from '../../lib/lifestyle/bodyFatEngine';
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
  sex: BodyFatSex;
  heightIn: string;
  neckIn: string;
  waistIn: string;
  hipIn: string;
}

const DEFAULTS: FormState = {
  sex: 'male',
  heightIn: '68',
  neckIn: '15',
  waistIn: '34',
  hipIn: '38',
};

function parsePositive(value: string): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function LifestyleBodyFatCalculator() {
  const initial = useMemo(
    () => loadPersistedJson<FormState>(LIFESTYLE_STORAGE_KEYS.bodyFat, DEFAULTS),
    [],
  );
  const [form, setForm] = useState<FormState>(initial);

  useEffect(() => {
    savePersistedJson(LIFESTYLE_STORAGE_KEYS.bodyFat, form);
  }, [form]);

  const result = useMemo(() => {
    const height = parsePositive(form.heightIn);
    const neck = parsePositive(form.neckIn);
    const waist = parsePositive(form.waistIn);
    const hip = parsePositive(form.hipIn) ?? 0;
    if (height === null || neck === null || waist === null) return null;

    const percent = computeNavyBodyFatPercent(form.sex, height, neck, waist, hip);
    if (percent === null || !Number.isFinite(percent) || percent < 0 || percent > 60) {
      return { error: 'Check measurements — waist must exceed neck (and hip required for women).' };
    }
    const category = bodyFatCategory(form.sex, percent);
    return { percent, category };
  }, [form]);

  return (
    <div className="space-y-6">
      <p className="text-sm font-medium leading-relaxed text-slate-200">
        US Navy circumference method. Measure neck below the larynx, waist at navel level, and hip at the
        widest point — all in inches.
      </p>

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

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className={LIFESTYLE_LABEL_CLASS}>Height (in)</span>
          <input
            type="number"
            min={1}
            step="0.1"
            value={form.heightIn}
            onChange={(e) => setForm((f) => ({ ...f, heightIn: e.target.value }))}
            className={LIFESTYLE_INPUT_CLASS}
          />
        </label>
        <label className="block text-sm">
          <span className={LIFESTYLE_LABEL_CLASS}>Neck (in)</span>
          <input
            type="number"
            min={1}
            step="0.1"
            value={form.neckIn}
            onChange={(e) => setForm((f) => ({ ...f, neckIn: e.target.value }))}
            className={LIFESTYLE_INPUT_CLASS}
          />
        </label>
        <label className="block text-sm">
          <span className={LIFESTYLE_LABEL_CLASS}>Waist (in)</span>
          <input
            type="number"
            min={1}
            step="0.1"
            value={form.waistIn}
            onChange={(e) => setForm((f) => ({ ...f, waistIn: e.target.value }))}
            className={LIFESTYLE_INPUT_CLASS}
          />
        </label>
        {form.sex === 'female' && (
          <label className="block text-sm">
            <span className={LIFESTYLE_LABEL_CLASS}>Hip (in)</span>
            <input
              type="number"
              min={1}
              step="0.1"
              value={form.hipIn}
              onChange={(e) => setForm((f) => ({ ...f, hipIn: e.target.value }))}
              className={LIFESTYLE_INPUT_CLASS}
            />
          </label>
        )}
      </div>

      {result && 'error' in result ? (
        <p className="rounded-xl border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          {result.error}
        </p>
      ) : result ? (
        <div className={LIFESTYLE_RESULT_PANEL_CLASS}>
          <p className="text-xs font-semibold uppercase tracking-wider text-canvas-accent">Body fat estimate</p>
          <p className="mt-1 text-3xl font-bold text-white tabular-nums">{result.percent.toFixed(1)}%</p>
          <p className="mt-2 text-base font-semibold text-slate-200">{result.category.label}</p>
          <p className="mt-1 text-sm font-medium leading-relaxed text-slate-200">{result.category.description}</p>
        </div>
      ) : (
        <p className="text-sm font-medium text-slate-200">Enter measurements to estimate body fat %.</p>
      )}
    </div>
  );
}
