import { useEffect, useMemo, useRef, useState } from 'react';
import type { Chart } from 'chart.js';
import { clamp, formatInr, formatInrShort } from '../../lib/finance/formatInr';
import { projectSipMonthByMonth, type StepUpMode } from '../../lib/finance/sipEngine';
import {
  destroyChart,
  GSM_CHART_COLORS,
  gsmLegendOptions,
  gsmScaleOptions,
  gsmTooltipOptions,
  renderChart,
} from '../../lib/charts/chartHelper';
import { buildCsv, downloadCsv } from '../../lib/export/toolExport';

const STORAGE_KEY = 'gsm-tools:sip-calculator';
const INFLATION_BASELINE = 6;

interface SavedState {
  monthlyInvestment: number;
  returnRate: number;
  timePeriodYears: number;
  stepUpMode: StepUpMode;
  stepUpValue: number;
  inflationAdjust: boolean;
}

const DEFAULTS: SavedState = {
  monthlyInvestment: 10_000,
  returnRate: 12,
  timePeriodYears: 15,
  stepUpMode: 'percent',
  stepUpValue: 10,
  inflationAdjust: false,
};

function loadState(): SavedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<SavedState>;
    return {
      monthlyInvestment:
        typeof parsed.monthlyInvestment === 'number' ? parsed.monthlyInvestment : DEFAULTS.monthlyInvestment,
      returnRate: typeof parsed.returnRate === 'number' ? parsed.returnRate : DEFAULTS.returnRate,
      timePeriodYears: typeof parsed.timePeriodYears === 'number' ? parsed.timePeriodYears : DEFAULTS.timePeriodYears,
      stepUpMode: parsed.stepUpMode === 'amount' ? 'amount' : 'percent',
      stepUpValue: typeof parsed.stepUpValue === 'number' ? parsed.stepUpValue : DEFAULTS.stepUpValue,
      inflationAdjust: Boolean(parsed.inflationAdjust),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export default function SipCalculatorTool() {
  const initial = useMemo(() => loadState(), []);
  const [monthlyInvestment, setMonthlyInvestment] = useState(initial.monthlyInvestment);
  const [returnRate, setReturnRate] = useState(initial.returnRate);
  const [timePeriodYears, setTimePeriodYears] = useState(initial.timePeriodYears);
  const [stepUpMode, setStepUpMode] = useState<StepUpMode>(initial.stepUpMode);
  const [stepUpValue, setStepUpValue] = useState(initial.stepUpValue);
  const [inflationAdjust, setInflationAdjust] = useState(initial.inflationAdjust);

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
        stepUpMode,
        stepUpValue,
        inflationAdjust,
        inflationPct: INFLATION_BASELINE,
      }),
    [monthlyInvestment, returnRate, timePeriodYears, stepUpMode, stepUpValue, inflationAdjust],
  );

  const result = projection.result;
  const yearly = projection.yearly;

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          monthlyInvestment,
          returnRate,
          timePeriodYears,
          stepUpMode,
          stepUpValue,
          inflationAdjust,
        }),
      );
    } catch {
      /* ignore */
    }
  }, [monthlyInvestment, returnRate, timePeriodYears, stepUpMode, stepUpValue, inflationAdjust]);

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
              backgroundColor: [GSM_CHART_COLORS.primary, GSM_CHART_COLORS.secondary],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: {
            legend: { ...gsmLegendOptions(), position: 'bottom' },
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
              borderColor: GSM_CHART_COLORS.primary,
              backgroundColor: 'rgba(52, 211, 153, 0.12)',
              fill: true,
              tension: 0.3,
              pointRadius: 2,
            },
            {
              label: inflationAdjust ? 'Nominal corpus' : 'Total wealth',
              data: yearly.map((r) => r.corpus),
              borderColor: GSM_CHART_COLORS.secondary,
              backgroundColor: 'rgba(251, 191, 36, 0.08)',
              fill: false,
              tension: 0.3,
              pointRadius: 2,
            },
            ...(inflationAdjust
              ? [
                  {
                    label: 'Real value (6% inflation)',
                    data: yearly.map((r) => r.realCorpus ?? r.corpus),
                    borderColor: '#38bdf8',
                    fill: false,
                    tension: 0.3,
                    pointRadius: 2,
                  },
                ]
              : []),
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: gsmScaleOptions(formatInrShort),
          plugins: {
            legend: { ...gsmLegendOptions(), position: 'bottom' },
            tooltip: gsmTooltipOptions((v) => formatInr(v)),
          },
        },
      });
    })();

    return () => {
      doughnutChart.current = destroyChart(doughnutChart.current);
      lineChart.current = destroyChart(lineChart.current);
    };
  }, [result, yearly, inflationAdjust]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">SIP details</h2>
          <div className="mt-5 space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="text-sm font-medium text-slate-300">Monthly investment (₹)</label>
                <input
                  type="number"
                  min={500}
                  value={monthlyInvestment}
                  onChange={(e) => setMonthlyInvestment(clamp(Number(e.target.value) || 0, 500, 500_000))}
                  className="input-field w-36 text-right tabular-nums sm:w-40"
                />
              </div>
              <input
                type="range"
                min={500}
                max={100_000}
                step={500}
                value={clamp(monthlyInvestment, 500, 100_000)}
                onChange={(e) => setMonthlyInvestment(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="text-sm font-medium text-slate-300">Expected return (% p.a.)</label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  step={0.1}
                  value={returnRate}
                  onChange={(e) => setReturnRate(clamp(Number(e.target.value) || 0, 0, 30))}
                  className="input-field w-36 text-right tabular-nums sm:w-40"
                />
              </div>
              <input
                type="range"
                min={1}
                max={24}
                step={0.5}
                value={clamp(returnRate, 1, 24)}
                onChange={(e) => setReturnRate(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="text-sm font-medium text-slate-300">Time horizon (years)</label>
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={timePeriodYears}
                  onChange={(e) => setTimePeriodYears(clamp(Number(e.target.value) || 1, 1, 40))}
                  className="input-field w-36 text-right tabular-nums sm:w-40"
                />
              </div>
              <input
                type="range"
                min={1}
                max={40}
                step={1}
                value={timePeriodYears}
                onChange={(e) => setTimePeriodYears(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-300">Annual step-up</legend>
              <div className="mb-3 flex gap-2">
                {(['percent', 'amount'] as StepUpMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setStepUpMode(m)}
                    className={`flex-1 rounded-xl border py-2 text-xs font-semibold ${
                      stepUpMode === m
                        ? 'border-emerald-500 bg-emerald-950/50 text-emerald-300'
                        : 'border-slate-700 text-slate-400'
                    }`}
                  >
                    {m === 'percent' ? 'Step-up %' : 'Step-up ₹'}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-slate-400">
                  {stepUpMode === 'percent' ? 'Increase % per year' : 'Increase ₹ per year'}
                </span>
                <input
                  type="number"
                  min={0}
                  value={stepUpValue}
                  onChange={(e) => setStepUpValue(Math.max(0, Number(e.target.value) || 0))}
                  className="input-field w-28 text-right tabular-nums"
                />
              </div>
              <input
                type="range"
                min={0}
                max={stepUpMode === 'percent' ? 25 : 50_000}
                step={stepUpMode === 'percent' ? 1 : 500}
                value={clamp(stepUpValue, 0, stepUpMode === 'percent' ? 25 : 50_000)}
                onChange={(e) => setStepUpValue(Number(e.target.value))}
                className="mt-2 w-full accent-emerald-500"
              />
            </fieldset>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3">
              <input
                type="checkbox"
                checked={inflationAdjust}
                onChange={(e) => setInflationAdjust(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 accent-emerald-500"
              />
              <span className="text-sm text-slate-300">
                Inflation adjustment ({INFLATION_BASELINE}% baseline — real purchasing power)
              </span>
            </label>

            <button
              type="button"
              onClick={() => {
                setMonthlyInvestment(DEFAULTS.monthlyInvestment);
                setReturnRate(DEFAULTS.returnRate);
                setTimePeriodYears(DEFAULTS.timePeriodYears);
                setStepUpMode(DEFAULTS.stepUpMode);
                setStepUpValue(DEFAULTS.stepUpValue);
                setInflationAdjust(false);
              }}
              className="btn-secondary w-full text-sm"
            >
              Reset
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-emerald-900/40 bg-gradient-to-br from-emerald-950/50 to-slate-900/60 p-5 shadow-xl sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-400/80">Wealth forecast</h2>
          <dl className="mt-5 space-y-4">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-slate-400">Maturity value</dt>
              <dd className="text-2xl font-bold tabular-nums text-emerald-400">
                {result ? formatInr(Math.round(result.totalValue)) : '₹0'}
              </dd>
            </div>
            <div className="flex justify-between gap-3 text-sm">
              <dt className="text-slate-400">Total invested</dt>
              <dd className="font-semibold tabular-nums text-white">
                {result ? formatInr(Math.round(result.totalInvested)) : '₹0'}
              </dd>
            </div>
            <div className="flex justify-between gap-3 text-sm">
              <dt className="text-slate-400">Wealth generated</dt>
              <dd className="font-semibold tabular-nums text-amber-300">
                {result ? formatInr(Math.round(result.estimatedReturns)) : '₹0'}
              </dd>
            </div>
            {inflationAdjust && result?.realTotalValue !== undefined && (
              <div className="flex justify-between gap-3 rounded-lg border border-sky-800/40 bg-sky-950/30 px-3 py-2 text-sm">
                <dt className="text-sky-300">Real value (today&apos;s money)</dt>
                <dd className="font-semibold tabular-nums text-sky-200">
                  {formatInr(Math.round(result.realTotalValue))}
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-6 grid h-48 grid-cols-2 gap-3">
            <div className="relative min-h-0">
              <canvas ref={doughnutRef} aria-label="Invested vs gains" />
            </div>
            <div className="relative min-h-0">
              <canvas ref={lineRef} aria-label="Year-wise growth" />
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Year-by-year breakdown</h2>
          <button
            type="button"
            disabled={!result}
            onClick={() => {
              downloadCsv(
                'sip-projection.csv',
                buildCsv(
                  inflationAdjust
                    ? ['Year', 'Invested', 'Nominal Corpus', 'Wealth Generated', 'Real Corpus']
                    : ['Year', 'Invested', 'Total Wealth', 'Wealth Generated'],
                  yearly.map((r) =>
                    inflationAdjust
                      ? [r.year, r.invested, r.corpus, r.gains, r.realCorpus ?? '']
                      : [r.year, r.invested, r.corpus, r.gains],
                  ),
                ),
              );
            }}
            className="btn-secondary text-xs"
          >
            Export CSV
          </button>
        </div>

        <div className="mt-4 overflow-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead className="bg-slate-900 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2">Year</th>
                <th className="px-4 py-2">Invested wealth</th>
                <th className="px-4 py-2">Total wealth</th>
                <th className="px-4 py-2">Wealth generated</th>
                {inflationAdjust && <th className="px-4 py-2">Real value</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              {yearly.map((r) => (
                <tr key={r.year} className="hover:bg-slate-800/40">
                  <td className="px-4 py-2 tabular-nums">{r.year}</td>
                  <td className="px-4 py-2 tabular-nums">{formatInr(r.invested)}</td>
                  <td className="px-4 py-2 tabular-nums text-emerald-300">{formatInr(r.corpus)}</td>
                  <td className="px-4 py-2 tabular-nums text-amber-300">{formatInr(r.gains)}</td>
                  {inflationAdjust && (
                    <td className="px-4 py-2 tabular-nums text-sky-300">
                      {r.realCorpus !== undefined ? formatInr(r.realCorpus) : '—'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
