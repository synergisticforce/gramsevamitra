import { useEffect, useMemo, useState } from 'react';
import { checkExamEligibility, formatDateLong, parseDateInput } from '../../lib/lifestyle/dateEngine';
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
  dob: string;
  referenceDate: string;
  minAge: string;
  maxAge: string;
  examName: string;
}

const today = () => new Date().toISOString().slice(0, 10);

const DEFAULTS: FormState = {
  dob: '1998-03-20',
  referenceDate: '2026-08-01',
  minAge: '21',
  maxAge: '32',
  examName: 'UPSC Civil Services',
};

function parseAge(value: string): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && Number.isInteger(n) ? n : null;
}

export default function LifestyleExamAgeCalculator() {
  const initial = useMemo(
    () => loadPersistedJson<FormState>(LIFESTYLE_STORAGE_KEYS.examAge, DEFAULTS),
    [],
  );
  const [form, setForm] = useState<FormState>(initial);

  useEffect(() => {
    savePersistedJson(LIFESTYLE_STORAGE_KEYS.examAge, form);
  }, [form]);

  const result = useMemo(() => {
    const dob = parseDateInput(form.dob);
    const ref = parseDateInput(form.referenceDate);
    const minAge = parseAge(form.minAge);
    const maxAge = parseAge(form.maxAge);
    if (!dob || !ref || minAge === null || maxAge === null) return null;
    if (minAge > maxAge) return { error: 'Minimum age cannot exceed maximum age.' };

    return checkExamEligibility(dob, ref, minAge, maxAge);
  }, [form]);

  return (
    <div className="space-y-6">
      <p className="text-sm font-medium leading-relaxed text-slate-200">
        Check whether a date of birth falls within the allowed age window on a government exam reference date
        (completed years as on that date).
      </p>

      <label className="block text-sm">
        <span className={LIFESTYLE_LABEL_CLASS}>Exam / notification name (optional)</span>
        <input
          type="text"
          value={form.examName}
          onChange={(e) => setForm((f) => ({ ...f, examName: e.target.value }))}
          className={LIFESTYLE_INPUT_CLASS}
          placeholder="e.g. SSC CGL 2026"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className={LIFESTYLE_LABEL_CLASS}>Your date of birth</span>
          <input
            type="date"
            value={form.dob}
            onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))}
            className={LIFESTYLE_INPUT_CLASS}
          />
        </label>
        <label className="block text-sm">
          <span className={LIFESTYLE_LABEL_CLASS}>Age counted on (reference date)</span>
          <input
            type="date"
            value={form.referenceDate}
            onChange={(e) => setForm((f) => ({ ...f, referenceDate: e.target.value }))}
            className={LIFESTYLE_INPUT_CLASS}
          />
        </label>
        <label className="block text-sm">
          <span className={LIFESTYLE_LABEL_CLASS}>Minimum age (years)</span>
          <input
            type="number"
            min={0}
            max={80}
            value={form.minAge}
            onChange={(e) => setForm((f) => ({ ...f, minAge: e.target.value }))}
            className={LIFESTYLE_INPUT_CLASS}
          />
        </label>
        <label className="block text-sm">
          <span className={LIFESTYLE_LABEL_CLASS}>Maximum age (years)</span>
          <input
            type="number"
            min={0}
            max={80}
            value={form.maxAge}
            onChange={(e) => setForm((f) => ({ ...f, maxAge: e.target.value }))}
            className={LIFESTYLE_INPUT_CLASS}
          />
        </label>
      </div>

      {result && 'error' in result ? (
        <p className="rounded-xl border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          {result.error}
        </p>
      ) : result ? (
        <div
          className={`${LIFESTYLE_RESULT_PANEL_CLASS} ${
            result.eligible ? 'border-emerald-500/40' : 'border-rose-500/40'
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-canvas-accent">
            {form.examName || 'Eligibility result'}
          </p>
          <p
            className={`mt-2 text-2xl font-bold ${result.eligible ? 'text-emerald-300' : 'text-rose-300'}`}
          >
            {result.eligible ? 'Eligible ✓' : 'Not eligible ✗'}
          </p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-200">{result.message}</p>
          <div className="mt-4 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
            <p>
              Earliest allowed DOB: <span className="text-slate-200">{formatDateLong(result.earliestBirth)}</span>
            </p>
            <p>
              Latest allowed DOB: <span className="text-slate-200">{formatDateLong(result.latestBirth)}</span>
            </p>
          </div>
          <p className="mt-3 text-xs font-medium text-slate-300">
            Always verify against the official notification — age relaxations and category rules may apply.
          </p>
        </div>
      ) : (
        <p className="text-sm font-medium text-slate-200">Enter DOB and age limits to check eligibility.</p>
      )}
    </div>
  );
}
