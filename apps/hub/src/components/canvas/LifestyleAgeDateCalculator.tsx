import { useEffect, useMemo, useState } from 'react';
import {
  ageBetween,
  durationBetween,
  formatDateLong,
  parseDateInput,
} from '../../lib/lifestyle/dateEngine';
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

type Mode = 'age' | 'duration';

interface FormState {
  mode: Mode;
  birthDate: string;
  asOfDate: string;
  startDate: string;
  endDate: string;
}

const today = () => new Date().toISOString().slice(0, 10);

const DEFAULTS: FormState = {
  mode: 'age',
  birthDate: '1995-06-15',
  asOfDate: today(),
  startDate: '2024-01-01',
  endDate: today(),
};

export default function LifestyleAgeDateCalculator() {
  const initial = useMemo(
    () => loadPersistedJson<FormState>(LIFESTYLE_STORAGE_KEYS.ageDate, DEFAULTS),
    [],
  );
  const [form, setForm] = useState<FormState>(initial);

  useEffect(() => {
    savePersistedJson(LIFESTYLE_STORAGE_KEYS.ageDate, form);
  }, [form]);

  const result = useMemo(() => {
    if (form.mode === 'age') {
      const birth = parseDateInput(form.birthDate);
      const asOf = parseDateInput(form.asOfDate);
      if (!birth || !asOf) return null;
      if (asOf < birth) return { error: 'Reference date must be on or after date of birth.' };
      const age = ageBetween(birth, asOf);
      return {
        type: 'age' as const,
        age,
        birth,
        asOf,
      };
    }

    const start = parseDateInput(form.startDate);
    const end = parseDateInput(form.endDate);
    if (!start || !end) return null;
    const duration = durationBetween(start, end);
    return {
      type: 'duration' as const,
      duration,
      start,
      end,
      reversed: end < start,
    };
  }, [form]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'age' as const, label: 'Exact age' },
            { id: 'duration' as const, label: 'Duration between dates' },
          ] as const
        ).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setForm((f) => ({ ...f, mode: id }))}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              form.mode === id
                ? 'bg-canvas-accent-muted text-white'
                : 'border border-canvas-border bg-canvas-surface text-slate-200 hover:bg-canvas-elevated'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {form.mode === 'age' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className={LIFESTYLE_LABEL_CLASS}>Date of birth</span>
            <input
              type="date"
              value={form.birthDate}
              onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))}
              className={LIFESTYLE_INPUT_CLASS}
            />
          </label>
          <label className="block text-sm">
            <span className={LIFESTYLE_LABEL_CLASS}>Age as on</span>
            <input
              type="date"
              value={form.asOfDate}
              onChange={(e) => setForm((f) => ({ ...f, asOfDate: e.target.value }))}
              className={LIFESTYLE_INPUT_CLASS}
            />
          </label>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className={LIFESTYLE_LABEL_CLASS}>Start date</span>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              className={LIFESTYLE_INPUT_CLASS}
            />
          </label>
          <label className="block text-sm">
            <span className={LIFESTYLE_LABEL_CLASS}>End date</span>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              className={LIFESTYLE_INPUT_CLASS}
            />
          </label>
        </div>
      )}

      {result && 'error' in result ? (
        <p className="rounded-xl border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          {result.error}
        </p>
      ) : result?.type === 'age' ? (
        <div className={LIFESTYLE_RESULT_PANEL_CLASS}>
          <p className="text-xs font-semibold uppercase tracking-wider text-canvas-accent">Exact age</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {result.age.years} years, {result.age.months} months, {result.age.days} days
          </p>
          <p className="mt-2 text-sm font-medium text-slate-200">
            {result.age.totalDays.toLocaleString()} total days lived
          </p>
          <p className="mt-2 text-xs text-slate-300">
            Born {formatDateLong(result.birth)} · calculated as on {formatDateLong(result.asOf)}
          </p>
        </div>
      ) : result?.type === 'duration' ? (
        <div className={LIFESTYLE_RESULT_PANEL_CLASS}>
          <p className="text-xs font-semibold uppercase tracking-wider text-canvas-accent">
            {result.reversed ? 'Duration (dates swapped)' : 'Duration'}
          </p>
          <p className="mt-2 text-2xl font-bold text-white">
            {result.duration.years} years, {result.duration.months} months, {result.duration.days} days
          </p>
          <p className="mt-2 text-sm font-medium text-slate-200">
            {result.duration.totalDays.toLocaleString()} total days
          </p>
          <p className="mt-2 text-xs text-slate-300">
            {formatDateLong(result.start)} → {formatDateLong(result.end)}
          </p>
        </div>
      ) : (
        <p className="text-sm font-medium text-slate-200">Select valid dates to calculate.</p>
      )}
    </div>
  );
}
