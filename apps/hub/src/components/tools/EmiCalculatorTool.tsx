import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Chart } from 'chart.js';
import {
  aggregateAmortizationByYear,
  analyzeLoan,
  tenureToMonths,
  type AmortizationRow,
  type AnnualAmortizationRow,
} from '../../lib/finance/loanEngine';
import { clamp, formatInr, formatInrShort } from '../../lib/finance/formatInr';
import {
  destroyChart,
  GSM_CHART_COLORS,
  gsmLegendOptions,
  gsmScaleOptions,
  gsmTooltipOptions,
  renderChart,
} from '../../lib/charts/chartHelper';
import { buildCsv, downloadCsv } from '../../lib/export/toolExport';

const STORAGE_KEY = 'gsm-tools:emi-calculator';

type TableView = 'monthly' | 'annual';
type SortKey = keyof AmortizationRow | keyof AnnualAmortizationRow;

interface Props {
  emphasisPrepayment?: boolean;
}

interface SavedState {
  loanAmount: number;
  interestRate: number;
  tenureValue: number;
  tenureUnit: 'years' | 'months';
  extraMonthly: number;
  lumpSumAmount: number;
  lumpSumMonth: number;
}

const DEFAULTS: SavedState = {
  loanAmount: 2_500_000,
  interestRate: 8.5,
  tenureValue: 20,
  tenureUnit: 'years',
  extraMonthly: 0,
  lumpSumAmount: 0,
  lumpSumMonth: 0,
};

function loadState(): SavedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<SavedState>;
    return {
      loanAmount: typeof parsed.loanAmount === 'number' ? parsed.loanAmount : DEFAULTS.loanAmount,
      interestRate: typeof parsed.interestRate === 'number' ? parsed.interestRate : DEFAULTS.interestRate,
      tenureValue: typeof parsed.tenureValue === 'number' ? parsed.tenureValue : DEFAULTS.tenureValue,
      tenureUnit: parsed.tenureUnit === 'months' ? 'months' : 'years',
      extraMonthly: typeof parsed.extraMonthly === 'number' ? parsed.extraMonthly : 0,
      lumpSumAmount: typeof parsed.lumpSumAmount === 'number' ? parsed.lumpSumAmount : 0,
      lumpSumMonth: typeof parsed.lumpSumMonth === 'number' ? parsed.lumpSumMonth : 0,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export default function EmiCalculatorTool({ emphasisPrepayment = false }: Props) {
  const initial = useMemo(() => loadState(), []);
  const [loanAmount, setLoanAmount] = useState(initial.loanAmount);
  const [interestRate, setInterestRate] = useState(initial.interestRate);
  const [tenureValue, setTenureValue] = useState(initial.tenureValue);
  const [tenureUnit, setTenureUnit] = useState<'years' | 'months'>(initial.tenureUnit);
  const [extraMonthly, setExtraMonthly] = useState(initial.extraMonthly);
  const [lumpSumAmount, setLumpSumAmount] = useState(initial.lumpSumAmount);
  const [lumpSumMonth, setLumpSumMonth] = useState(initial.lumpSumMonth);
  const [tableView, setTableView] = useState<TableView>('monthly');
  const [sortKey, setSortKey] = useState<string>('month');
  const [sortAsc, setSortAsc] = useState(true);
  const [showPrepay, setShowPrepay] = useState(emphasisPrepayment);

  const doughnutRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLCanvasElement>(null);
  const doughnutChart = useRef<Chart | null>(null);
  const barChart = useRef<Chart | null>(null);

  const months = tenureToMonths(tenureValue, tenureUnit);

  const analysis = useMemo(
    () =>
      analyzeLoan(loanAmount, interestRate, tenureValue, tenureUnit, {
        extraMonthly: Math.max(0, extraMonthly),
        lumpSumAmount: Math.max(0, lumpSumAmount),
        lumpSumMonth: Math.max(0, Math.round(lumpSumMonth)),
      }),
    [loanAmount, interestRate, tenureValue, tenureUnit, extraMonthly, lumpSumAmount, lumpSumMonth],
  );

  const annualRows = useMemo(
    () => aggregateAmortizationByYear(analysis.schedule),
    [analysis.schedule],
  );

  const sortedMonthly = useMemo(() => {
    const rows = [...analysis.schedule];
    rows.sort((a, b) => {
      const av = a[sortKey as keyof AmortizationRow] as number;
      const bv = b[sortKey as keyof AmortizationRow] as number;
      return sortAsc ? av - bv : bv - av;
    });
    return rows;
  }, [analysis.schedule, sortKey, sortAsc]);

  const sortedAnnual = useMemo(() => {
    const rows = [...annualRows];
    rows.sort((a, b) => {
      const av = a[sortKey as keyof AnnualAmortizationRow] as number;
      const bv = b[sortKey as keyof AnnualAmortizationRow] as number;
      return sortAsc ? av - bv : bv - av;
    });
    return rows;
  }, [annualRows, sortKey, sortAsc]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          loanAmount,
          interestRate,
          tenureValue,
          tenureUnit,
          extraMonthly,
          lumpSumAmount,
          lumpSumMonth,
        }),
      );
    } catch {
      /* ignore */
    }
  }, [loanAmount, interestRate, tenureValue, tenureUnit, extraMonthly, lumpSumAmount, lumpSumMonth]);

  useEffect(() => {
    const result = analysis.result;
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

      const slice = analysis.schedule.slice(0, 12);
      barChart.current = await renderChart(barCanvas, barChart.current, {
        type: 'bar',
        data: {
          labels: slice.map((r) => `M${r.month}`),
          datasets: [
            {
              label: 'Principal',
              data: slice.map((r) => Math.round(r.principalPaid - r.prepayment)),
              backgroundColor: GSM_CHART_COLORS.primary,
              borderRadius: 3,
            },
            {
              label: 'Interest',
              data: slice.map((r) => Math.round(r.interestPaid)),
              backgroundColor: GSM_CHART_COLORS.secondary,
              borderRadius: 3,
            },
            {
              label: 'Prepayment',
              data: slice.map((r) => Math.round(r.prepayment)),
              backgroundColor: '#38bdf8',
              borderRadius: 3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            ...gsmScaleOptions(formatInrShort),
            x: { ...gsmScaleOptions().x, stacked: true },
            y: { ...gsmScaleOptions(formatInrShort).y, stacked: true },
          },
          plugins: {
            legend: { ...gsmLegendOptions(), position: 'bottom' },
            tooltip: gsmTooltipOptions((v) => formatInr(v)),
          },
        },
      });
    })();

    return () => {
      doughnutChart.current = destroyChart(doughnutChart.current);
      barChart.current = destroyChart(barChart.current);
    };
  }, [analysis]);

  const toggleSort = useCallback((key: string) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortAsc((a) => !a);
        return prev;
      }
      setSortAsc(true);
      return key;
    });
  }, []);

  const exportCsv = useCallback(() => {
    const rows = analysis.schedule.map((r) => [
      r.month,
      Math.round(r.beginningBalance),
      Math.round(r.scheduledPayment),
      Math.round(r.prepayment),
      Math.round(r.principalPaid),
      Math.round(r.interestPaid),
      Math.round(r.endingBalance),
    ]);
    downloadCsv(
      'emi-amortization.csv',
      buildCsv(
        ['Month', 'Beginning Balance', 'Scheduled Payment', 'Prepayment', 'Principal Paid', 'Interest Paid', 'Ending Balance'],
        rows,
      ),
    );
  }, [analysis.schedule]);

  const result = analysis.result;

  const interestSaved = useMemo(() => {
    if (extraMonthly <= 0 && lumpSumAmount <= 0) return 0;
    const base = analyzeLoan(loanAmount, interestRate, tenureValue, tenureUnit, {
      extraMonthly: 0,
      lumpSumAmount: 0,
      lumpSumMonth: 0,
    });
    return base.result ? Math.max(0, base.result.totalInterest - (result?.totalInterest ?? 0)) : 0;
  }, [extraMonthly, lumpSumAmount, loanAmount, interestRate, tenureValue, tenureUnit, result?.totalInterest]);

  const sortIndicator = (key: string) => (sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : '');

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-canvas-accent-muted/60 p-5 shadow-none sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-subtle">Loan details</h2>
          <div className="mt-5 space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <label htmlFor="loan-amount" className="text-sm font-medium text-canvas-muted">
                  Loan amount (₹)
                </label>
                <input
                  id="loan-amount"
                  type="number"
                  min={1000}
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(clamp(Number(e.target.value) || 0, 1000, 100_000_000))}
                  className="input-field w-36 text-right tabular-nums sm:w-40"
                />
              </div>
              <input
                type="range"
                min={100_000}
                max={10_000_000}
                step={10_000}
                value={clamp(loanAmount, 100_000, 10_000_000)}
                onChange={(e) => setLoanAmount(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <label htmlFor="interest-rate" className="text-sm font-medium text-canvas-muted">
                  Interest rate (% p.a.)
                </label>
                <input
                  id="interest-rate"
                  type="number"
                  min={0}
                  max={30}
                  step={0.05}
                  value={interestRate}
                  onChange={(e) => setInterestRate(clamp(Number(e.target.value) || 0, 0, 30))}
                  className="input-field w-36 text-right tabular-nums sm:w-40"
                />
              </div>
              <input
                type="range"
                min={0}
                max={24}
                step={0.1}
                value={clamp(interestRate, 0, 24)}
                onChange={(e) => setInterestRate(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="tenure-value" className="text-sm font-medium text-canvas-muted">
                  Tenure
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="tenure-value"
                    type="number"
                    min={1}
                    value={tenureValue}
                    onChange={(e) => setTenureValue(clamp(Number(e.target.value) || 1, 1, 600))}
                    className="input-field w-20 text-right tabular-nums"
                  />
                  <select
                    value={tenureUnit}
                    onChange={(e) => setTenureUnit(e.target.value as 'years' | 'months')}
                    className="select-field w-28 py-2 text-sm"
                  >
                    <option value="years">Years</option>
                    <option value="months">Months</option>
                  </select>
                </div>
              </div>
              <input
                type="range"
                min={tenureUnit === 'years' ? 1 : 6}
                max={tenureUnit === 'years' ? 30 : 360}
                step={tenureUnit === 'years' ? 1 : 6}
                value={clamp(tenureValue, tenureUnit === 'years' ? 1 : 6, tenureUnit === 'years' ? 30 : 360)}
                onChange={(e) => setTenureValue(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowPrepay((s) => !s)}
              className="flex w-full items-center justify-between rounded-xl border border-canvas-border bg-slate-950/50 px-4 py-3 text-sm font-semibold text-canvas-muted"
            >
              Prepayment options
              <span className="text-canvas-accent">{showPrepay ? '−' : '+'}</span>
            </button>

            {showPrepay && (
              <div className="space-y-4 rounded-xl border border-sky-900/40 bg-sky-950/20 p-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-canvas-muted">Extra monthly prepayment (₹)</span>
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={extraMonthly}
                    onChange={(e) => setExtraMonthly(Math.max(0, Number(e.target.value) || 0))}
                    className="input-field w-full tabular-nums"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-canvas-muted">Lump-sum prepayment (₹)</span>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={lumpSumAmount}
                      onChange={(e) => setLumpSumAmount(Math.max(0, Number(e.target.value) || 0))}
                      className="input-field w-full tabular-nums"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-canvas-muted">Lump-sum at month #</span>
                    <input
                      type="number"
                      min={0}
                      max={months}
                      value={lumpSumMonth}
                      onChange={(e) => setLumpSumMonth(Math.max(0, Number(e.target.value) || 0))}
                      className="input-field w-full tabular-nums"
                    />
                  </label>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setLoanAmount(DEFAULTS.loanAmount);
                setInterestRate(DEFAULTS.interestRate);
                setTenureValue(DEFAULTS.tenureValue);
                setTenureUnit(DEFAULTS.tenureUnit);
                setExtraMonthly(0);
                setLumpSumAmount(0);
                setLumpSumMonth(0);
              }}
              className="btn-secondary w-full text-sm"
            >
              Reset
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-canvas-border bg-gradient-to-br from-emerald-950/50 to-slate-900/60 p-5 shadow-none sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-accent/80">Loan summary</h2>
          <dl className="mt-5 space-y-4">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-canvas-subtle">Monthly EMI</dt>
              <dd className="text-2xl font-bold tabular-nums text-canvas-accent">
                {result ? formatInr(Math.round(result.emi)) : '₹0'}
              </dd>
            </div>
            <div className="flex justify-between gap-3 text-sm">
              <dt className="text-canvas-subtle">Total interest</dt>
              <dd className="font-semibold tabular-nums text-amber-300">
                {result ? formatInr(Math.round(result.totalInterest)) : '₹0'}
              </dd>
            </div>
            <div className="flex justify-between gap-3 text-sm">
              <dt className="text-canvas-subtle">Total payment</dt>
              <dd className="font-semibold tabular-nums text-canvas-text">
                {result ? formatInr(Math.round(result.totalPayment)) : '₹0'}
              </dd>
            </div>
            {interestSaved > 0 && (
              <div className="flex justify-between gap-3 rounded-lg border border-sky-800/40 bg-sky-950/30 px-3 py-2 text-sm">
                <dt className="text-sky-300">Interest saved via prepayment</dt>
                <dd className="font-semibold tabular-nums text-sky-200">{formatInr(Math.round(interestSaved))}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3 text-sm">
              <dt className="text-canvas-subtle">Payoff tenure</dt>
              <dd className="font-semibold tabular-nums text-canvas-text">
                {result ? `${result.tenureMonths} months` : '—'}
              </dd>
            </div>
          </dl>

          <div className="mt-6 grid h-44 grid-cols-2 gap-3">
            <div className="relative min-h-0">
              <canvas ref={doughnutRef} aria-label="Principal vs interest split" />
            </div>
            <div className="relative min-h-0">
              <canvas ref={barRef} aria-label="First 12 months principal and interest" />
            </div>
          </div>

          {result && (
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-canvas-elevated">
              <div className="flex h-full">
                <div className="bg-canvas-accent-soft0" style={{ width: `${result.principalPct}%` }} />
                <div className="bg-amber-400" style={{ width: `${result.interestPct}%` }} />
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-canvas-accent-muted/60 p-5 shadow-none sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-subtle">Amortization schedule</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-canvas-border p-0.5">
              {(['monthly', 'annual'] as TableView[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTableView(v)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${
                    tableView === v ? 'bg-emerald-950/60 text-canvas-accent' : 'text-canvas-subtle'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <button type="button" onClick={exportCsv} disabled={!result} className="btn-secondary text-xs">
              Export CSV
            </button>
          </div>
        </div>

        <div className="mt-4 max-h-[28rem] overflow-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[44rem] text-left text-xs sm:text-sm">
            <thead className="sticky top-0 bg-canvas-accent-muted text-[10px] font-semibold uppercase tracking-wider text-canvas-subtle">
              <tr>
                {tableView === 'monthly' ? (
                  <>
                    <th className="cursor-pointer px-3 py-2" onClick={() => toggleSort('month')}>
                      Month{sortIndicator('month')}
                    </th>
                    <th className="cursor-pointer px-3 py-2" onClick={() => toggleSort('beginningBalance')}>
                      Beginning{sortIndicator('beginningBalance')}
                    </th>
                    <th className="cursor-pointer px-3 py-2" onClick={() => toggleSort('scheduledPayment')}>
                      Scheduled{sortIndicator('scheduledPayment')}
                    </th>
                    <th className="cursor-pointer px-3 py-2" onClick={() => toggleSort('prepayment')}>
                      Prepay{sortIndicator('prepayment')}
                    </th>
                    <th className="cursor-pointer px-3 py-2" onClick={() => toggleSort('principalPaid')}>
                      Principal{sortIndicator('principalPaid')}
                    </th>
                    <th className="cursor-pointer px-3 py-2" onClick={() => toggleSort('interestPaid')}>
                      Interest{sortIndicator('interestPaid')}
                    </th>
                    <th className="cursor-pointer px-3 py-2" onClick={() => toggleSort('endingBalance')}>
                      Ending{sortIndicator('endingBalance')}
                    </th>
                  </>
                ) : (
                  <>
                    <th className="cursor-pointer px-3 py-2" onClick={() => toggleSort('year')}>
                      Year{sortIndicator('year')}
                    </th>
                    <th className="px-3 py-2">Beginning</th>
                    <th className="px-3 py-2">Scheduled</th>
                    <th className="px-3 py-2">Prepay</th>
                    <th className="px-3 py-2">Principal</th>
                    <th className="px-3 py-2">Interest</th>
                    <th className="px-3 py-2">Ending</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-canvas-muted">
              {tableView === 'monthly'
                ? sortedMonthly.map((r) => (
                    <tr key={r.month} className="hover:bg-canvas-elevated/40">
                      <td className="px-3 py-2 tabular-nums">{r.month}</td>
                      <td className="px-3 py-2 tabular-nums">{formatInr(Math.round(r.beginningBalance))}</td>
                      <td className="px-3 py-2 tabular-nums">{formatInr(Math.round(r.scheduledPayment))}</td>
                      <td className="px-3 py-2 tabular-nums text-sky-300">
                        {r.prepayment > 0 ? formatInr(Math.round(r.prepayment)) : '—'}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{formatInr(Math.round(r.principalPaid))}</td>
                      <td className="px-3 py-2 tabular-nums text-amber-300/90">
                        {formatInr(Math.round(r.interestPaid))}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{formatInr(Math.round(r.endingBalance))}</td>
                    </tr>
                  ))
                : sortedAnnual.map((r) => (
                    <tr key={r.year} className="hover:bg-canvas-elevated/40">
                      <td className="px-3 py-2 tabular-nums">{r.year}</td>
                      <td className="px-3 py-2 tabular-nums">{formatInr(Math.round(r.beginningBalance))}</td>
                      <td className="px-3 py-2 tabular-nums">{formatInr(Math.round(r.scheduledPayment))}</td>
                      <td className="px-3 py-2 tabular-nums text-sky-300">
                        {r.prepayment > 0 ? formatInr(Math.round(r.prepayment)) : '—'}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{formatInr(Math.round(r.principalPaid))}</td>
                      <td className="px-3 py-2 tabular-nums text-amber-300/90">
                        {formatInr(Math.round(r.interestPaid))}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{formatInr(Math.round(r.endingBalance))}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
