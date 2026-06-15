import { useEffect, useMemo, useRef, useState } from 'react';
import type { Chart } from 'chart.js';
import { destroyChart, gsmTooltipOptions, renderChart } from '../../lib/charts/chartHelper';
import {
  FINANCE_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/financeCanvasStorage';
import { clamp, formatInr } from '../../lib/finance/formatInr';
import { aggregateAmortizationByYear, analyzeLoan, tenureToMonths } from '../../lib/finance/loanEngine';

interface LoanFormState {
  loanAmount: number;
  interestRate: number;
  tenureYears: number;
  extraMonthly: number;
  lumpSumAmount: number;
  lumpSumMonth: number;
}

const DEFAULTS: LoanFormState = {
  loanAmount: 1_500_000,
  interestRate: 9,
  tenureYears: 15,
  extraMonthly: 5_000,
  lumpSumAmount: 100_000,
  lumpSumMonth: 24,
};

const LIGHT_LEGEND = {
  labels: { color: '#64748b', boxWidth: 12, padding: 12, font: { size: 11 } },
};

export default function FinanceLoanRepaymentCalculator() {
  const initial = useMemo(
    () => loadPersistedJson<LoanFormState>(FINANCE_STORAGE_KEYS.loan, DEFAULTS),
    []
  );

  const [loanAmount, setLoanAmount] = useState(initial.loanAmount);
  const [interestRate, setInterestRate] = useState(initial.interestRate);
  const [tenureYears, setTenureYears] = useState(initial.tenureYears);
  const [extraMonthly, setExtraMonthly] = useState(initial.extraMonthly);
  const [lumpSumAmount, setLumpSumAmount] = useState(initial.lumpSumAmount);
  const [lumpSumMonth, setLumpSumMonth] = useState(initial.lumpSumMonth);

  const chartRef = useRef<HTMLCanvasElement>(null);
  const chart = useRef<Chart | null>(null);

  const baseline = useMemo(
    () =>
      analyzeLoan(loanAmount, interestRate, tenureYears, 'years', {
        extraMonthly: 0,
        lumpSumAmount: 0,
        lumpSumMonth: 0,
      }),
    [loanAmount, interestRate, tenureYears]
  );

  const withPrepay = useMemo(
    () =>
      analyzeLoan(loanAmount, interestRate, tenureYears, 'years', {
        extraMonthly: Math.max(0, extraMonthly),
        lumpSumAmount: Math.max(0, lumpSumAmount),
        lumpSumMonth: Math.max(0, Math.round(lumpSumMonth)),
      }),
    [extraMonthly, interestRate, loanAmount, lumpSumAmount, lumpSumMonth, tenureYears]
  );

  const result = withPrepay.result;
  const baselineResult = baseline.result;
  const annualRows = useMemo(
    () => aggregateAmortizationByYear(withPrepay.schedule),
    [withPrepay.schedule]
  );

  const interestSaved =
    baselineResult && result
      ? Math.max(0, baselineResult.totalInterest - result.totalInterest)
      : 0;
  const monthsSaved =
    baselineResult && result
      ? Math.max(0, baselineResult.tenureMonths - result.tenureMonths)
      : 0;

  useEffect(() => {
    savePersistedJson(FINANCE_STORAGE_KEYS.loan, {
      loanAmount,
      interestRate,
      tenureYears,
      extraMonthly,
      lumpSumAmount,
      lumpSumMonth,
    });
  }, [extraMonthly, interestRate, loanAmount, lumpSumAmount, lumpSumMonth, tenureYears]);

  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas || annualRows.length === 0) {
      chart.current = destroyChart(chart.current);
      return;
    }

    const labels = annualRows.map((r) => `Y${r.year}`);
    void (async () => {
      chart.current = await renderChart(canvas, chart.current, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Principal',
              data: annualRows.map((r) => Math.round(r.principalPaid)),
              backgroundColor: '#059669',
              borderRadius: 3,
            },
            {
              label: 'Interest',
              data: annualRows.map((r) => Math.round(r.interestPaid)),
              backgroundColor: '#d97706',
              borderRadius: 3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { stacked: true, grid: { display: false } },
            y: {
              stacked: true,
              ticks: { callback: (v) => formatInr(Number(v)) },
            },
          },
          plugins: {
            legend: { ...LIGHT_LEGEND, position: 'bottom' },
            tooltip: gsmTooltipOptions((v) => formatInr(v)),
          },
        },
      });
    })();

    return () => {
      chart.current = destroyChart(chart.current);
    };
  }, [annualRows]);

  const inputClass =
    'w-full rounded-xl border border-canvas-border px-3 py-2.5 text-sm text-canvas-text outline-none ring-canvas-accent/50/30 focus:border-canvas-accent focus:ring-2 tabular-nums';

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-subtle">Loan & prepayments</h2>
        <div className="mt-4 space-y-4">
          <label className="block text-sm font-medium text-canvas-muted">
            Loan amount (₹)
            <input
              type="number"
              min={10_000}
              value={loanAmount}
              onChange={(e) => setLoanAmount(clamp(Number(e.target.value) || 0, 10_000, 50_000_000))}
              className={`${inputClass} mt-1.5`}
            />
          </label>
          <label className="block text-sm font-medium text-canvas-muted">
            Interest rate ({interestRate}% p.a.)
            <input
              type="range"
              min={5}
              max={18}
              step={0.1}
              value={interestRate}
              onChange={(e) => setInterestRate(Number(e.target.value))}
              className="mt-2 w-full accent-emerald-600"
            />
          </label>
          <label className="block text-sm font-medium text-canvas-muted">
            Tenure ({tenureYears} years)
            <input
              type="range"
              min={1}
              max={30}
              value={tenureYears}
              onChange={(e) => setTenureYears(Number(e.target.value))}
              className="mt-2 w-full accent-emerald-600"
            />
          </label>
          <label className="block text-sm font-medium text-canvas-muted">
            Extra monthly prepayment (₹)
            <input
              type="number"
              min={0}
              value={extraMonthly}
              onChange={(e) => setExtraMonthly(Math.max(0, Number(e.target.value) || 0))}
              className={`${inputClass} mt-1.5`}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-canvas-muted">
              Lump sum (₹)
              <input
                type="number"
                min={0}
                value={lumpSumAmount}
                onChange={(e) => setLumpSumAmount(Math.max(0, Number(e.target.value) || 0))}
                className={`${inputClass} mt-1.5`}
              />
            </label>
            <label className="block text-sm font-medium text-canvas-muted">
              Lump sum month
              <input
                type="number"
                min={1}
                max={600}
                value={lumpSumMonth}
                onChange={(e) => setLumpSumMonth(Math.max(1, Number(e.target.value) || 1))}
                className={`${inputClass} mt-1.5`}
              />
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-canvas-border bg-gradient-to-br from-canvas-accent-soft/40 to-canvas-surface p-5 shadow-none">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-accent">Repayment plan</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-canvas-subtle">Monthly EMI</dt>
            <dd className="text-xl font-bold text-canvas-accent">
              {result ? formatInr(Math.round(result.emi)) : '₹0'}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-canvas-subtle">Payoff tenure</dt>
            <dd className="font-semibold">{result ? `${result.tenureMonths} months` : '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-canvas-subtle">Interest saved vs. no prepay</dt>
            <dd className="font-semibold text-indigo-700">{formatInr(Math.round(interestSaved))}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-canvas-subtle">Months saved</dt>
            <dd className="font-semibold">{monthsSaved} mo</dd>
          </div>
        </dl>
        <div className="relative mt-5 h-56 rounded-xl border border-slate-100 bg-canvas-surface p-2">
          <canvas ref={chartRef} aria-label="Annual principal vs interest" />
        </div>
        <p className="mt-2 text-center text-xs font-medium leading-relaxed text-slate-300">
          {tenureToMonths(tenureYears, 'years')} month schedule · {annualRows.length} years shown
        </p>
      </section>
    </div>
  );
}
