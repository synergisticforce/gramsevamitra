import { useEffect, useMemo, useRef, useState } from 'react';
import type { Chart } from 'chart.js';
import {
  destroyChart,
  gsmTooltipOptions,
  renderChart,
} from '../../lib/charts/chartHelper';
import { clamp, formatInr, formatInrShort } from '../../lib/finance/formatInr';
import { projectSipMonthByMonth } from '../../lib/finance/sipEngine';
import {
  FINANCE_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/financeCanvasStorage';

interface SipFormState {
  monthlyInvestment: number;
  returnRate: number;
  timePeriodYears: number;
}

const DEFAULTS: SipFormState = {
  monthlyInvestment: 10_000,
  returnRate: 12,
  timePeriodYears: 15,
};

const LIGHT_LEGEND = {
  labels: { color: '#64748b', boxWidth: 12, padding: 12, font: { size: 11 } },
};

const LIGHT_SCALES = {
  x: {
    ticks: { color: '#94a3b8', font: { size: 10 }, maxRotation: 0 },
    grid: { color: '#e2e8f0' },
  },
  y: {
    ticks: {
      color: '#94a3b8',
      font: { size: 10 },
      callback: (value: string | number) => formatInrShort(Number(value)),
    },
    grid: { color: '#e2e8f0' },
  },
};

export default function FinanceSipCalculator() {
  const initial = useMemo(
    () => loadPersistedJson<SipFormState>(FINANCE_STORAGE_KEYS.sip, DEFAULTS),
    []
  );
  const [monthlyInvestment, setMonthlyInvestment] = useState(initial.monthlyInvestment);
  const [returnRate, setReturnRate] = useState(initial.returnRate);
  const [timePeriodYears, setTimePeriodYears] = useState(initial.timePeriodYears);

  const doughnutRef = useRef<HTMLCanvasElement>(null);
  const lineRef = useRef<HTMLCanvasElement>(null);
  const doughnutChart = useRef<Chart | null>(null);
  const lineChart = useRef<Chart | null>(null);

  const projection = useMemo(
    () =>
      projectSipMonthByMonth({
        monthlyInvestment,
        annualReturnPct: returnRate,
        years: timePeriodYears,
        stepUpMode: 'percent',
        stepUpValue: 0,
        inflationAdjust: false,
      }),
    [monthlyInvestment, returnRate, timePeriodYears]
  );

  const result = projection.result;
  const yearly = projection.yearly;

  useEffect(() => {
    savePersistedJson(FINANCE_STORAGE_KEYS.sip, {
      monthlyInvestment,
      returnRate,
      timePeriodYears,
    });
  }, [monthlyInvestment, returnRate, timePeriodYears]);

  useEffect(() => {
    const doughnutCanvas = doughnutRef.current;
    const lineCanvas = lineRef.current;
    if (!doughnutCanvas || !lineCanvas) return;

    if (!result) {
      doughnutChart.current = destroyChart(doughnutChart.current);
      lineChart.current = destroyChart(lineChart.current);
      return;
    }

    void (async () => {
      doughnutChart.current = await renderChart(doughnutCanvas, doughnutChart.current, {
        type: 'doughnut',
        data: {
          labels: ['Invested', 'Wealth generated'],
          datasets: [
            {
              data: [Math.round(result.totalInvested), Math.round(result.estimatedReturns)],
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

      lineChart.current = await renderChart(lineCanvas, lineChart.current, {
        type: 'line',
        data: {
          labels: yearly.map((r) => `Yr ${r.year}`),
          datasets: [
            {
              label: 'Invested',
              data: yearly.map((r) => r.invested),
              borderColor: '#059669',
              backgroundColor: 'rgba(5, 150, 105, 0.1)',
              fill: true,
              tension: 0.3,
              pointRadius: 2,
            },
            {
              label: 'Total wealth',
              data: yearly.map((r) => r.corpus),
              borderColor: '#d97706',
              fill: false,
              tension: 0.3,
              pointRadius: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: LIGHT_SCALES,
          plugins: {
            legend: { ...LIGHT_LEGEND, position: 'bottom' },
            tooltip: gsmTooltipOptions((v) => formatInr(v)),
          },
        },
      });
    })();

    return () => {
      doughnutChart.current = destroyChart(doughnutChart.current);
      lineChart.current = destroyChart(lineChart.current);
    };
  }, [result, yearly]);

  const inputClass =
    'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none ring-emerald-500/30 focus:border-emerald-400 focus:ring-2 tabular-nums';

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">SIP details</h2>
        <div className="mt-4 space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="text-sm font-medium text-slate-700">Monthly investment (₹)</label>
              <input
                type="number"
                min={500}
                value={monthlyInvestment}
                onChange={(e) => setMonthlyInvestment(clamp(Number(e.target.value) || 0, 500, 500_000))}
                className={`${inputClass} w-32 text-right`}
              />
            </div>
            <input
              type="range"
              min={500}
              max={100_000}
              step={500}
              value={clamp(monthlyInvestment, 500, 100_000)}
              onChange={(e) => setMonthlyInvestment(Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="text-sm font-medium text-slate-700">Expected return (% p.a.)</label>
              <input
                type="number"
                min={0}
                max={30}
                step={0.1}
                value={returnRate}
                onChange={(e) => setReturnRate(clamp(Number(e.target.value) || 0, 0, 30))}
                className={`${inputClass} w-24 text-right`}
              />
            </div>
            <input
              type="range"
              min={1}
              max={24}
              step={0.5}
              value={clamp(returnRate, 1, 24)}
              onChange={(e) => setReturnRate(Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="text-sm font-medium text-slate-700">Time horizon (years)</label>
              <input
                type="number"
                min={1}
                max={40}
                value={timePeriodYears}
                onChange={(e) => setTimePeriodYears(clamp(Number(e.target.value) || 1, 1, 40))}
                className={`${inputClass} w-20 text-right`}
              />
            </div>
            <input
              type="range"
              min={1}
              max={40}
              step={1}
              value={timePeriodYears}
              onChange={(e) => setTimePeriodYears(Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-700">Wealth forecast</h2>
        <dl className="mt-4 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-slate-600">Maturity value</dt>
            <dd className="text-2xl font-bold tabular-nums text-emerald-700">
              {result ? formatInr(Math.round(result.totalValue)) : '₹0'}
            </dd>
          </div>
          <div className="flex justify-between gap-3 text-sm">
            <dt className="text-slate-500">Total invested</dt>
            <dd className="font-semibold tabular-nums text-slate-900">
              {result ? formatInr(Math.round(result.totalInvested)) : '₹0'}
            </dd>
          </div>
          <div className="flex justify-between gap-3 text-sm">
            <dt className="text-slate-500">Wealth generated</dt>
            <dd className="font-semibold tabular-nums text-amber-700">
              {result ? formatInr(Math.round(result.estimatedReturns)) : '₹0'}
            </dd>
          </div>
        </dl>

        <div className="mt-5 grid h-48 grid-cols-2 gap-3">
          <div className="relative min-h-0 rounded-xl border border-slate-100 bg-white p-2">
            <canvas ref={doughnutRef} aria-label="Invested vs wealth generated" />
          </div>
          <div className="relative min-h-0 rounded-xl border border-slate-100 bg-white p-2">
            <canvas ref={lineRef} aria-label="Year-wise SIP growth" />
          </div>
        </div>
      </section>
    </div>
  );
}
