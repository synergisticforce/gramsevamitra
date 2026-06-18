import { useEffect, useMemo, useState } from 'react';
import { formatDateLong, parseDateInput, predictMenstrualCycle } from '../../lib/lifestyle/dateEngine';
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
  lastPeriod: string;
  cycleLength: string;
}

const DEFAULTS: FormState = {
  lastPeriod: new Date().toISOString().slice(0, 10),
  cycleLength: '28',
};

export default function LifestyleMenstrualCalculator() {
  const initial = useMemo(
    () => loadPersistedJson<FormState>(LIFESTYLE_STORAGE_KEYS.menstrual, DEFAULTS),
    [],
  );
  const [form, setForm] = useState<FormState>(initial);

  useEffect(() => {
    savePersistedJson(LIFESTYLE_STORAGE_KEYS.menstrual, form);
  }, [form]);

  const result = useMemo(() => {
    const last = parseDateInput(form.lastPeriod);
    const length = Number(form.cycleLength);
    if (!last || !Number.isFinite(length) || length < 21 || length > 45) return null;
    return predictMenstrualCycle(last, length);
  }, [form]);

  return (
    <div className="space-y-6">
      <p className="text-sm font-medium leading-relaxed text-slate-200">
        Estimates are based on average cycle math (ovulation ≈ 14 days before the next period). Not a substitute
        for medical advice or contraception planning.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className={LIFESTYLE_LABEL_CLASS}>First day of last period</span>
          <input
            type="date"
            value={form.lastPeriod}
            onChange={(e) => setForm((f) => ({ ...f, lastPeriod: e.target.value }))}
            className={LIFESTYLE_INPUT_CLASS}
          />
        </label>
        <label className="block text-sm">
          <span className={LIFESTYLE_LABEL_CLASS}>Average cycle length (days)</span>
          <input
            type="number"
            min={21}
            max={45}
            value={form.cycleLength}
            onChange={(e) => setForm((f) => ({ ...f, cycleLength: e.target.value }))}
            className={LIFESTYLE_INPUT_CLASS}
          />
        </label>
      </div>

      {result ? (
        <div className={`${LIFESTYLE_RESULT_PANEL_CLASS} space-y-3`}>
          <div>
            <p className="text-xs font-medium text-slate-300">Next period (estimated)</p>
            <p className="text-lg font-bold text-white">{formatDateLong(result.nextPeriod)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-300">Ovulation (estimated)</p>
            <p className="text-lg font-bold text-canvas-accent">{formatDateLong(result.ovulation)}</p>
          </div>
          <div className="rounded-lg bg-canvas-elevated px-3 py-2">
            <p className="text-xs font-medium text-slate-300">Fertile window</p>
            <p className="text-sm font-semibold text-slate-200">
              {formatDateLong(result.fertileStart)} — {formatDateLong(result.fertileEnd)}
            </p>
            <p className="mt-1 text-xs text-slate-300">5 days before ovulation through day after ovulation</p>
          </div>
          <p className="text-xs text-slate-300">Cycle used: {result.cycleLength} days</p>
        </div>
      ) : (
        <p className="text-sm font-medium text-slate-200">
          Enter last period date and a cycle length between 21–45 days.
        </p>
      )}
    </div>
  );
}
