import { useEffect, useMemo, useRef, useState } from 'react';
import type { Chart } from 'chart.js';
import {
  destroyChart,
  gsmTooltipOptions,
  renderChart,
} from '../../lib/charts/chartHelper';
import { clamp, formatInr, formatInrShort } from '../../lib/finance/formatInr';
import { analyzeLoan, tenureToMonths } from '../../lib/finance/loanEngine';
import {
  FINANCE_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/financeCanvasStorage';

interface EmiFormState {
  loanAmount: number;
  interestRate: number;
  tenureYears: number;
}

const DEFAULTS: EmiFormState = {
  loanAmount: 2_500_000,
  interestRate: 8.5,
  tenureYears: 20,
};

const LIGHT_LEGEND = {
  labels: { color: '#64748b', boxWidth: 12, padding: 12, font: { size: 11 } },
};

const LIGHT_BAR_SCALES = {
  x: {
    ticks: { color: '#94a3b8', font: { size: 10 }, maxRotation: 0 },
    grid: { color: '#e2e8f0' },
    stacked: true,
  },
  y: {
    ticks: {
      color: '#94a3b8',
      font: { size: 10 },
      callback: (value: string | number) => formatInrShort(Number(value)),
    },
    grid: { color: '#e2e8f0' },
    stacked: true,
  },
};

export default function FinanceEmiCalculator() {
  const initial = useMemo(
    () => loadPersistedJson<EmiFormState>(FINANCE_STORAGE_KEYS.emi, DEFAULTS),
    []
  );
  const [loanAmount, setLoanAmount] = useState(initial.loanAmount);
  const [interestRate, setInterestRate] = useState(initial.interestRate);
  const [tenureYears, setTenureYears] = useState(initial.tenureYears);

  const doughnutRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLCanvasElement>(null);
  const doughnutChart = useRef<Chart | null>(null);
  const barChart = useRef<Chart | null>(null);

  const analysis = useMemo(
    () => analyzeLoan(loanAmount, interestRate, tenureYears, 'years'),
    [loanAmount, interestRate, tenureYears]
  );

  const result = analysis.result;
  const months = tenureToMonths(tenureYears, 'years');

  useEffect(() => {
    savePersistedJson(FINANCE_STORAGE_KEYS.emi, { loanAmount, interestRate, tenureYears });
  }, [loanAmount, interestRate, tenureYears]);

  useEffect(() => {
    const doughnutCanvas = doughnutRef.current;
    const barCanvas = barRef.current;
    if (!doughnutCanvas || !barCanvas) return;

    if (!result) {
      doughnutChart.current = destroyChart(doughnutChart.current);
      barChart.current = destroyChart(barChart.current);
      return;
    }

    void (async () => {
      doughnutChart.current = await renderChart(doughnutCanvas, doughnutChart.current, {
        type: 'doughnut',
        data: {
          labels: ['Principal', 'Interest'],
          datasets: [
            {
              data: [Math.round(result.principal), Math.round(result.totalInterest)],
              backgroundColor: ['#059669', '#d97706'],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: {
            legend: { ...LIGHT_LEGEND, position: 'bottom' },
            tooltip: gsmTooltipOptions((v) => formatInr(v)),
          },
        },
      });

      const slice = analysis.schedule.slice(0, 12);
      barChart.current = await renderChart(barCanvas, barChart.current, {
        type: 'bar',
        data: {
          labels: slice.map((r) => `M${r.month}`),
          datasets: [
            {
              label: 'Principal',
              data: slice.map((r) => Math.round(r.principalPaid - r.prepayment)),
              backgroundColor: '#059669',
              borderRadius: 3,
            },
            {
              label: 'Interest',
              data: slice.map((r) => Math.round(r.interestPaid)),
              backgroundColor: '#d97706',
              borderRadius: 3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: LIGHT_BAR_SCALES,
          plugins: {
            legend: { ...LIGHT_LEGEND, position: 'bottom' },
            tooltip: gsmTooltipOptions((v) => formatInr(v)),
          },
        },
      });
    })();

    return () => {
      doughnutChart.current = destroyChart(doughnutChart.current);
      barChart.current = destroyChart(barChart.current);
    };
  }, [analysis, result]);

  const inputClass =
    'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none ring-emerald-500/30 focus:border-emerald-400 focus:ring-2 tabular-nums';

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Loan details</h2>
        <div className="mt-4 space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="text-sm font-medium text-slate-700">Loan amount (₹)</label>
              <input
                type="number"
                min={10_000}
                value={loanAmount}
                onChange={(e) => setLoanAmount(clamp(Number(e.target.value) || 0, 10_000, 50_000_000))}
                className={`${inputClass} w-36 text-right`}
              />
            </div>
            <input
              type="range"
              min={100_000}
              max={10_000_000}
              step={50_000}
              value={clamp(loanAmount, 100_000, 10_000_000)}
              onChange={(e) => setLoanAmount(Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="text-sm font-medium text-slate-700">Interest rate (% p.a.)</label>
              <input
                type="number"
                min={0}
                max={30}
                step={0.1}
                value={interestRate}
                onChange={(e) => setInterestRate(clamp(Number(e.target.value) || 0, 0, 30))}
                className={`${inputClass} w-24 text-right`}
              />
            </div>
            <input
              type="range"
              min={5}
              max={18}
              step={0.1}
              value={clamp(interestRate, 5, 18)}
              onChange={(e) => setInterestRate(Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="text-sm font-medium text-slate-700">Tenure (years)</label>
              <input
                type="number"
                min={1}
                max={30}
                value={tenureYears}
                onChange={(e) => setTenureYears(clamp(Number(e.target.value) || 1, 1, 30))}
                className={`${inputClass} w-20 text-right`}
              />
            </div>
            <input
              type="range"
              min={1}
              max={30}
              step={1}
              value={tenureYears}
              onChange={(e) => setTenureYears(Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-700">EMI breakdown</h2>
        <dl className="mt-4 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-slate-600">Monthly EMI</dt>
            <dd className="text-2xl font-bold tabular-nums text-emerald-700">
              {result ? formatInr(Math.round(result.emi)) : '₹0'}
            </dd>
          </div>
          <div className="flex justify-between gap-3 text-sm">
            <dt className="text-slate-500">Total payment ({months} months)</dt>
            <dd className="font-semibold tabular-nums text-slate-900">
              {result ? formatInr(Math.round(result.totalPayment)) : '₹0'}
            </dd>
          </div>
          <div className="flex justify-between gap-3 text-sm">
            <dt className="text-slate-500">Total interest</dt>
            <dd className="font-semibold tabular-nums text-amber-700">
              {result ? formatInr(Math.round(result.totalInterest)) : '₹0'}
            </dd>
          </div>
        </dl>

        <div className="mt-5 grid h-48 grid-cols-2 gap-3">
          <div className="relative min-h-0 rounded-xl border border-slate-100 bg-white p-2">
            <canvas ref={doughnutRef} aria-label="Principal vs interest" />
          </div>
          <div className="relative min-h-0 rounded-xl border border-slate-100 bg-white p-2">
            <canvas ref={barRef} aria-label="First 12 months principal and interest" />
          </div>
        </div>
      </section>
    </div>
  );
}
