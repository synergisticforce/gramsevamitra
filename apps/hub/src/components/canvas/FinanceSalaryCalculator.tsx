import { useMemo, useState } from 'react';
import {
  computeSalaryBreakdown,
  formatInr,
  formatLpa,
  type SalaryCalcInput,
  type TaxRegime,
} from '../../lib/canvas/careerSalaryCalc';

export default function FinanceSalaryCalculator() {
  const [annualCtcLakhs, setAnnualCtcLakhs] = useState(12);
  const [basicPercent, setBasicPercent] = useState(40);
  const [pfEnabled, setPfEnabled] = useState(true);
  const [professionalTaxMonthly, setProfessionalTaxMonthly] = useState(200);
  const [includeTaxEstimate, setIncludeTaxEstimate] = useState(true);
  const [taxRegime, setTaxRegime] = useState<TaxRegime>('new');

  const input: SalaryCalcInput = useMemo(
    () => ({
      annualCtc: annualCtcLakhs * 100_000,
      basicPercent,
      pfEnabled,
      professionalTaxMonthly,
      includeTaxEstimate,
      taxRegime,
    }),
    [annualCtcLakhs, basicPercent, pfEnabled, professionalTaxMonthly, includeTaxEstimate, taxRegime],
  );

  const breakdown = useMemo(() => computeSalaryBreakdown(input), [input]);

  const rows = [
    { label: 'Annual CTC', value: formatLpa(breakdown.annualCtc) },
    { label: 'Monthly gross', value: formatInr(breakdown.grossMonthly) },
    { label: 'Employee PF', value: formatInr(breakdown.employeePfMonthly) },
    { label: 'Professional tax', value: formatInr(breakdown.professionalTaxMonthly) },
    {
      label: 'Est. income tax',
      value: includeTaxEstimate ? formatInr(breakdown.estimatedTaxMonthly) : '—',
    },
    { label: 'Total deductions', value: formatInr(breakdown.totalDeductionsMonthly) },
  ];

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
          Annual CTC (₹ lakhs): {annualCtcLakhs.toFixed(1)}
        </span>
        <input
          type="range"
          min={3}
          max={100}
          step={0.5}
          value={annualCtcLakhs}
          onChange={(event) => setAnnualCtcLakhs(Number(event.target.value))}
          className="mt-2 w-full accent-emerald-500"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
          Basic salary (% of CTC): {basicPercent}%
        </span>
        <input
          type="range"
          min={30}
          max={60}
          step={1}
          value={basicPercent}
          onChange={(event) => setBasicPercent(Number(event.target.value))}
          className="mt-2 w-full accent-emerald-500"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
          Professional tax (₹/month)
        </span>
        <input
          type="number"
          min={0}
          max={2500}
          value={professionalTaxMonthly}
          onChange={(event) => setProfessionalTaxMonthly(Number(event.target.value))}
          className="mt-1.5 w-full rounded-xl border border-canvas-border bg-canvas-surface px-3 py-2.5 text-sm text-slate-200"
        />
      </label>

      <label className="flex items-center gap-2 text-sm font-medium leading-relaxed text-slate-200">
        <input
          type="checkbox"
          checked={pfEnabled}
          onChange={(event) => setPfEnabled(event.target.checked)}
          className="rounded accent-emerald-500"
        />
        Include employee EPF (12%, capped)
      </label>

      <label className="flex items-center gap-2 text-sm font-medium leading-relaxed text-slate-200">
        <input
          type="checkbox"
          checked={includeTaxEstimate}
          onChange={(event) => setIncludeTaxEstimate(event.target.checked)}
          className="rounded accent-emerald-500"
        />
        Estimate income tax (simplified slabs)
      </label>

      {includeTaxEstimate && (
        <div className="flex gap-2">
          {(['new', 'old'] as TaxRegime[]).map((regime) => (
            <button
              key={regime}
              type="button"
              onClick={() => setTaxRegime(regime)}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                taxRegime === regime
                  ? 'border-emerald-400 bg-canvas-elevated text-emerald-200'
                  : 'border-canvas-border text-slate-200 hover:bg-canvas-elevated'
              }`}
            >
              {regime === 'new' ? 'New regime' : 'Old regime'}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-canvas-border bg-canvas-elevated p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Monthly in-hand</p>
        <p className="mt-1 text-3xl font-bold text-canvas-text">{formatInr(breakdown.inHandMonthly)}</p>
        <p className="mt-1 text-sm text-slate-200">Annual in-hand: {formatInr(breakdown.inHandAnnual)}</p>
      </div>

      <ul className="space-y-2 rounded-xl border border-canvas-border bg-canvas-elevated p-3">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-slate-300">{row.label}</span>
            <span className="font-semibold text-canvas-text">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
