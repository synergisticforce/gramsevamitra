import { useEffect, useMemo, useRef, useState } from 'react';
import type { Chart } from 'chart.js';
import { destroyChart, gsmTooltipOptions, renderChart } from '../../lib/charts/chartHelper';
import {
  FINANCE_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/financeCanvasStorage';
import { formatInr } from '../../lib/finance/formatInr';
import {
  computeCryptoGains,
  createCryptoTradeId,
  portfolioDistribution,
  type CryptoTrade,
} from '../../lib/finance/cryptoGainsEngine';

const DEFAULT_TRADES: CryptoTrade[] = [
  {
    id: createCryptoTradeId(),
    asset: 'BTC',
    type: 'buy',
    quantity: 0.01,
    priceInr: 4_500_000,
    date: '2024-01-15',
  },
  {
    id: createCryptoTradeId(),
    asset: 'BTC',
    type: 'sell',
    quantity: 0.005,
    priceInr: 5_200_000,
    date: '2025-03-10',
  },
  {
    id: createCryptoTradeId(),
    asset: 'ETH',
    type: 'buy',
    quantity: 0.5,
    priceInr: 180_000,
    date: '2024-06-01',
  },
];

const LIGHT_LEGEND = {
  labels: { color: '#64748b', boxWidth: 12, padding: 12, font: { size: 11 } },
};

export default function FinanceCryptoGainsCalculator() {
  const initial = useMemo(
    () => loadPersistedJson<{ trades: CryptoTrade[] }>(FINANCE_STORAGE_KEYS.crypto, { trades: DEFAULT_TRADES }),
    []
  );
  const [trades, setTrades] = useState<CryptoTrade[]>(initial.trades);

  const doughnutRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLCanvasElement>(null);
  const doughnutChart = useRef<Chart | null>(null);
  const barChart = useRef<Chart | null>(null);

  const gains = useMemo(() => computeCryptoGains(trades), [trades]);
  const portfolio = useMemo(() => portfolioDistribution(trades), [trades]);
  const totalGain = useMemo(() => gains.reduce((s, g) => s + g.totalGain, 0), [gains]);

  useEffect(() => {
    savePersistedJson(FINANCE_STORAGE_KEYS.crypto, { trades });
  }, [trades]);

  useEffect(() => {
    const doughnutCanvas = doughnutRef.current;
    const barCanvas = barRef.current;
    if (!doughnutCanvas || !barCanvas) return;

    void (async () => {
      doughnutChart.current = await renderChart(doughnutCanvas, doughnutChart.current, {
        type: 'doughnut',
        data: {
          labels: portfolio.map((p) => p.asset),
          datasets: [
            {
              data: portfolio.map((p) => Math.round(p.value)),
              backgroundColor: ['#059669', '#0284c7', '#d97706', '#7c3aed', '#db2777'],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { ...LIGHT_LEGEND, position: 'bottom' },
            tooltip: gsmTooltipOptions((v) => formatInr(v)),
          },
        },
      });

      barChart.current = await renderChart(barCanvas, barChart.current, {
        type: 'bar',
        data: {
          labels: gains.map((g) => g.asset),
          datasets: [
            {
              label: 'Realized gain (FIFO)',
              data: gains.map((g) => Math.round(g.totalGain)),
              backgroundColor: gains.map((g) => (g.totalGain >= 0 ? '#059669' : '#e11d48')),
              borderRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: gsmTooltipOptions((v) => formatInr(v)),
          },
          scales: {
            y: { ticks: { callback: (v) => formatInr(Number(v)) } },
          },
        },
      });
    })();

    return () => {
      doughnutChart.current = destroyChart(doughnutChart.current);
      barChart.current = destroyChart(barChart.current);
    };
  }, [gains, portfolio]);

  const inputClass =
    'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-400 focus:ring-2';

  const addTrade = () => {
    setTrades((prev) => [
      ...prev,
      {
        id: createCryptoTradeId(),
        asset: 'BTC',
        type: 'buy',
        quantity: 0,
        priceInr: 0,
        date: new Date().toISOString().slice(0, 10),
      },
    ]);
  };

  const updateTrade = (index: number, patch: Partial<CryptoTrade>) => {
    setTrades((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const removeTrade = (index: number) => {
    setTrades((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
          <p className="text-xs font-semibold uppercase text-emerald-700">Total realized gain</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${totalGain >= 0 ? 'text-emerald-900' : 'text-rose-700'}`}>
            {formatInr(totalGain)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Trades</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{trades.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Assets tracked</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{gains.length}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-56 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Portfolio distribution</p>
          <div className="h-44">
            <canvas ref={doughnutRef} />
          </div>
        </div>
        <div className="h-56 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Gains by asset (FIFO)</p>
          <div className="h-44">
            <canvas ref={barRef} />
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Trade log</h2>
          <button type="button" onClick={addTrade} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">
            + Add trade
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {trades.map((trade, index) => (
            <div key={trade.id} className="grid grid-cols-2 gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 sm:grid-cols-6">
              <input value={trade.asset} onChange={(e) => updateTrade(index, { asset: e.target.value.toUpperCase() })} placeholder="Asset" className={inputClass} />
              <select value={trade.type} onChange={(e) => updateTrade(index, { type: e.target.value as 'buy' | 'sell' })} className={inputClass}>
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
              <input type="number" min={0} step="any" value={trade.quantity} onChange={(e) => updateTrade(index, { quantity: Number(e.target.value) || 0 })} placeholder="Qty" className={inputClass} />
              <input type="number" min={0} value={trade.priceInr} onChange={(e) => updateTrade(index, { priceInr: Number(e.target.value) || 0 })} placeholder="Price (₹)" className={inputClass} />
              <input type="date" value={trade.date} onChange={(e) => updateTrade(index, { date: e.target.value })} className={inputClass} />
              <button type="button" onClick={() => removeTrade(index)} className="rounded-xl border border-rose-200 text-xs font-semibold text-rose-600 hover:bg-rose-50">
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
