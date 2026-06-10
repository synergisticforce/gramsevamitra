import type { Chart, ChartConfiguration } from 'chart.js';

let chartModulePromise: Promise<typeof import('chart.js')> | null = null;

/** Lazy-load Chart.js with only the controllers we use (doughnut, line, bar). */
export async function loadGsmCharts(): Promise<typeof import('chart.js')> {
  if (!chartModulePromise) {
    chartModulePromise = (async () => {
      const mod = await import('chart.js');
      mod.Chart.register(
        mod.DoughnutController,
        mod.ArcElement,
        mod.LineController,
        mod.LineElement,
        mod.PointElement,
        mod.BarController,
        mod.BarElement,
        mod.CategoryScale,
        mod.LinearScale,
        mod.Tooltip,
        mod.Legend,
        mod.Filler,
      );
      return mod;
    })();
  }
  return chartModulePromise;
}

export const GSM_CHART_COLORS = {
  primary: '#34d399',
  secondary: '#fbbf24',
  muted: '#64748b',
  grid: '#334155',
  text: '#94a3b8',
  surface: '#0f172a',
} as const;

export function gsmLegendOptions() {
  return {
    labels: {
      color: GSM_CHART_COLORS.text,
      boxWidth: 12,
      padding: 14,
      font: { size: 11 },
    },
  };
}

export function gsmTooltipOptions(formatValue?: (value: number) => string) {
  return {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    titleColor: '#e2e8f0',
    bodyColor: GSM_CHART_COLORS.text,
    borderColor: GSM_CHART_COLORS.grid,
    borderWidth: 1,
    padding: 10,
    callbacks: formatValue
      ? {
          label: (ctx: { parsed: number | { y?: number }; dataset: { label?: string } }) => {
            const raw = typeof ctx.parsed === 'number' ? ctx.parsed : (ctx.parsed.y ?? 0);
            return `${ctx.dataset.label ?? ''}: ${formatValue(raw)}`;
          },
        }
      : undefined,
  };
}

export function gsmScaleOptions(formatTick?: (value: number) => string) {
  return {
    x: {
      ticks: { color: GSM_CHART_COLORS.muted, font: { size: 10 }, maxRotation: 0 },
      grid: { color: GSM_CHART_COLORS.grid },
    },
    y: {
      ticks: {
        color: GSM_CHART_COLORS.muted,
        font: { size: 10 },
        callback: formatTick
          ? (value: string | number) => formatTick(Number(value))
          : undefined,
      },
      grid: { color: GSM_CHART_COLORS.grid },
    },
  };
}

/** Create or update a chart instance on the given canvas. */
export async function renderChart(
  canvas: HTMLCanvasElement,
  existing: Chart | null,
  config: ChartConfiguration,
): Promise<Chart> {
  const { Chart } = await loadGsmCharts();
  if (existing) {
    existing.data = config.data;
    if (config.options) existing.options = config.options;
    existing.update('none');
    return existing;
  }
  return new Chart(canvas, config);
}

export function destroyChart(chart: Chart | null): null {
  chart?.destroy();
  return null;
}
