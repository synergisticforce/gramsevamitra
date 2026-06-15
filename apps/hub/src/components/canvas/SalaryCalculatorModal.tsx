import { useMemo, useState } from 'react';
import {
  computeSalaryBreakdown,
  formatInr,
  formatLpa,
  type SalaryCalcInput,
  type TaxRegime,
} from '../../lib/canvas/careerSalaryCalc';

interface Props {
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export default function SalaryCalculatorModal({ onClose, onSuccess }: Props) {
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
    [annualCtcLakhs, basicPercent, pfEnabled, professionalTaxMonthly, includeTaxEstimate, taxRegime]
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
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="salary-calc-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="salary-calc-title" className="text-lg font-bold text-canvas-text">
              💰 Salary &amp; Take-Home Calculator
            </h2>
            <p className="mt-1 text-sm text-canvas-subtle">
              Estimate in-hand pay from CTC with standard EPF — computed locally.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-canvas-subtle transition hover:bg-canvas-elevated hover:text-canvas-muted"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-4">
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
              className="mt-2 w-full accent-sky-600"
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
              className="mt-2 w-full accent-sky-600"
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
              className="mt-1.5 w-full rounded-xl border border-canvas-border px-3 py-2.5 text-sm"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-canvas-muted">
            <input
              type="checkbox"
              checked={pfEnabled}
              onChange={(event) => setPfEnabled(event.target.checked)}
              className="rounded accent-sky-600"
            />
            Include employee EPF (12%, capped)
          </label>

          <label className="flex items-center gap-2 text-sm text-canvas-muted">
            <input
              type="checkbox"
              checked={includeTaxEstimate}
              onChange={(event) => setIncludeTaxEstimate(event.target.checked)}
              className="rounded accent-sky-600"
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
                      ? 'border-sky-400 bg-sky-50 text-sky-800'
                      : 'border-canvas-border text-canvas-muted hover:bg-canvas-elevated'
                  }`}
                >
                  {regime === 'new' ? 'New regime' : 'Old regime'}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Monthly in-hand</p>
          <p className="mt-1 text-3xl font-bold text-sky-900">{formatInr(breakdown.inHandMonthly)}</p>
          <p className="mt-1 text-sm text-sky-700">
            Annual in-hand: {formatInr(breakdown.inHandAnnual)}
          </p>
        </div>

        <ul className="mt-4 space-y-2 rounded-xl border border-canvas-border bg-canvas-elevated p-3">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-canvas-subtle">{row.label}</span>
              <span className="font-semibold text-canvas-text">{row.value}</span>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => {
              onSuccess(`Take-home estimate: ${formatInr(breakdown.inHandMonthly)}/month.`);
              onClose();
            }}
            className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-sky-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
