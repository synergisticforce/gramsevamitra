import { useEffect, useMemo, useState } from 'react';
import { calculateAge, todayIso } from '../../lib/date/ageEngine';

const STORAGE_KEY = 'gsm-tools:age-calculator';

export default function AgeCalculatorTool() {
  const [dob, setDob] = useState('');
  const [compare, setCompare] = useState(todayIso());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as { dob?: string; compare?: string };
        if (s.dob) setDob(s.dob);
        if (s.compare) setCompare(s.compare);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const result = useMemo(() => calculateAge(dob, compare), [dob, compare]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ dob, compare }));
    } catch {
      /* ignore */
    }
  }, [dob, compare]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-800 bg-canvas-accent-muted/60 p-5 shadow-none sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-subtle">Dates</h2>
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-canvas-muted">Date of birth</span>
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="input-field w-full" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-canvas-muted">Compare date</span>
            <input type="date" value={compare} onChange={(e) => setCompare(e.target.value)} className="input-field w-full" />
          </label>
        </div>
        <button type="button" onClick={() => setCompare(todayIso())} className="btn-secondary mt-6 w-full text-sm">
          Reset compare date to today
        </button>
      </section>

      <section className="rounded-2xl border border-canvas-border bg-gradient-to-br from-emerald-950/50 to-slate-900/60 p-5 shadow-none sm:p-6" aria-live="polite">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-accent/80">Age difference</h2>
        {!result ? (
          <p className="mt-5 text-center text-canvas-subtle">Select a date of birth</p>
        ) : result.invalid ? (
          <div className="mt-5 text-center">
            <p className="text-xl font-bold text-rose-400">Invalid range</p>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-200">{result.invalid}</p>
          </div>
        ) : (
          <>
            <div className="mt-5 text-center">
              <p className="text-3xl font-extrabold tabular-nums text-canvas-text sm:text-4xl">
                {result.years}y {result.months}m {result.days}d
              </p>
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-200">As of {result.compareLabel}</p>
            </div>
            <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
              {[
                { label: 'Years', value: result.years },
                { label: 'Months', value: result.months },
                { label: 'Days', value: result.days },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-800 bg-slate-950/50 px-2 py-3">
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-canvas-subtle">{item.label}</dt>
                  <dd className="mt-1 text-2xl font-bold tabular-nums text-canvas-accent">{item.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-4 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-canvas-subtle">Total days</span>
                <span className="font-semibold tabular-nums text-canvas-text">{result.totalDays.toLocaleString('en-IN')}</span>
              </div>
              <div className="mt-2 flex justify-between gap-2 border-t border-slate-800 pt-2">
                <span className="text-canvas-subtle">Born on</span>
                <span className="font-semibold text-canvas-accent">{result.birthLabel}</span>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
