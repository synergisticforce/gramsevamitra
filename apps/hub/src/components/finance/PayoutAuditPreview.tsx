import { useMemo, useState } from 'react';
import { applyBps, toMinorUnits, unlockSplit } from '../../lib/audit/currency';

export type AuditMode = 'owner' | 'seller' | 'munshi';
type SampleId = 'swiggy' | 'zomato' | 'flipkart';

interface SampleRow {
  id: string;
  label: string;
  billedPaise: number;
  expectedPaise: number;
}

interface SampleAudit {
  title: string;
  yoursPaise: number;
  feePaise: number;
  heldCount: number;
  heldPaise: number;
  taxCreditPaise: number;
  totalFoundPaise?: number;
  rows: SampleRow[];
  note: string;
}

const FLIPKART_FOUND = toMinorUnits('₹308.20');
const FLIPKART_SPLIT = unlockSplit(FLIPKART_FOUND);

const SAMPLES: Record<SampleId, SampleAudit> = {
  swiggy: {
    title: 'Swiggy weekly payout — sample',
    yoursPaise: 184500,
    feePaise: 20500,
    heldCount: 1,
    heldPaise: 42000,
    taxCreditPaise: 3690,
    rows: [
      { id: 'SW-18421', label: 'Commission on order', billedPaise: 8600, expectedPaise: 6400 },
      { id: 'SW-18488', label: 'Long-distance fee', billedPaise: 3500, expectedPaise: 0 },
      { id: 'SW-18502', label: 'GST on platform fee', billedPaise: 1548, expectedPaise: 1152 },
    ],
    note: 'Section 9(5) customer GST stays a pass-through in this sample. It is not shown as a loss.',
  },
  zomato: {
    title: 'Zomato settlement — sample',
    yoursPaise: 156200,
    feePaise: 17355,
    heldCount: 0,
    heldPaise: 0,
    taxCreditPaise: 3124,
    rows: [
      { id: 'ZM-90211', label: 'Commission rate', billedPaise: 7200, expectedPaise: 5400 },
      { id: 'ZM-90240', label: 'Addition shown as a deduction', billedPaise: 2500, expectedPaise: 0 },
    ],
    note: 'The sample keeps Addition and Deduction on separate lines so a refund is not subtracted twice.',
  },
  flipkart: {
    title: 'Flipkart STL — sample',
    yoursPaise: FLIPKART_SPLIT.userShareMinor,
    feePaise: FLIPKART_SPLIT.feeMinor,
    totalFoundPaise: FLIPKART_FOUND,
    heldCount: 0,
    heldPaise: 0,
    taxCreditPaise: 2214,
    rows: [
      { id: 'FK-2000', label: 'Short payment on ₹2,000 item', billedPaise: FLIPKART_FOUND, expectedPaise: 0 },
    ],
    note: 'Total found is ₹308.20. ₹277.38 stays with you and ₹30.82 is the 10% check fee.',
  },
};

function formatPaise(paise: number): string {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(paise));
  const rupees = Math.floor(abs / 100).toLocaleString('en-IN');
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}₹${rupees}.${frac}`;
}

interface Props {
  mode: AuditMode;
}

export default function PayoutAuditPreview({ mode }: Props) {
  const [sampleId, setSampleId] = useState<SampleId>('swiggy');
  const sample = SAMPLES[sampleId];
  const recoverable = useMemo(() => {
    if (typeof sample.totalFoundPaise === 'number') return sample.totalFoundPaise;
    return sample.rows.reduce((sum, row) => sum + (row.billedPaise - row.expectedPaise), 0);
  }, [sample]);

  return (
    <div className="rounded-2xl border border-canvas-border bg-canvas-surface p-4 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-canvas-accent">Sample preview</p>
      <h2 className="mt-1 text-xl font-bold text-canvas-text sm:text-2xl">
        {mode === 'seller' ? 'Seller weight and COD check' : mode === 'munshi' ? 'Munshi client desk' : 'Restaurant two-pocket check'}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">
        These numbers are built into the page so you can click through the view. A real Excel, CSV, or PDF uses the checker above. Spreadsheets stay on this device. Nothing here calls a paid AI API.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {(
          [
            ['swiggy', 'Try Swiggy sample'],
            ['zomato', 'Try Zomato sample'],
            ['flipkart', 'Try Flipkart sample'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSampleId(id)}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
              sampleId === id
                ? 'border-canvas-accent bg-canvas-accent-soft text-canvas-text'
                : 'border-canvas-border text-canvas-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="mt-4 text-sm font-semibold text-canvas-text">{sample.title}</p>

      {typeof sample.totalFoundPaise === 'number' && (
        <div className="mt-4 rounded-2xl border border-canvas-border bg-canvas-elevated px-4 py-4">
          <p className="text-xs font-semibold uppercase text-slate-300">Total found</p>
          <p className="mt-1 text-4xl font-bold text-canvas-text">{formatPaise(sample.totalFoundPaise)}</p>
        </div>
      )}

      {(mode !== 'seller' || typeof sample.totalFoundPaise === 'number') && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-emerald-700/40 bg-emerald-950/40 p-4">
            <p className="text-xs font-semibold uppercase text-emerald-200">Yours · 90%</p>
            <p className="mt-1 text-3xl font-bold text-white">{formatPaise(sample.yoursPaise)}</p>
          </div>
          <div className="rounded-2xl border border-sky-700/40 bg-sky-950/40 p-4">
            <p className="text-xs font-semibold uppercase text-sky-200">Check fee · 10%</p>
            <p className="mt-1 text-3xl font-bold text-white">{formatPaise(sample.feePaise)}</p>
          </div>
        </div>
      )}

      {sample.heldCount > 0 && (
        <div className="mt-3 rounded-2xl border border-amber-600/50 bg-amber-950/40 p-4">
          <p className="text-sm font-bold text-amber-100">
            {sample.heldCount} held order · {formatPaise(sample.heldPaise)} waiting in the partner app
          </p>
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-slate-400">
              <th className="py-2 pr-3">Order</th>
              <th className="py-2 pr-3">Check</th>
              <th className="py-2 pr-3">Billed</th>
              <th className="py-2">Expected</th>
            </tr>
          </thead>
          <tbody>
            {sample.rows.map((row) => (
              <tr key={`${row.id}-${row.label}`} className="border-t border-canvas-border">
                <td className="py-2 pr-3 font-medium text-canvas-text">{row.id}</td>
                <td className="py-2 pr-3 text-slate-300">{row.label}</td>
                <td className="py-2 pr-3">{formatPaise(row.billedPaise)}</td>
                <td className="py-2">{formatPaise(row.expectedPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-canvas-border px-3 py-3">
          <p className="text-xs uppercase text-slate-400">Sample recoverable</p>
          <p className="text-lg font-bold text-canvas-text">{formatPaise(recoverable)}</p>
        </div>
        <div className="rounded-xl border border-canvas-border px-3 py-3">
          <p className="text-xs uppercase text-slate-400">Sample tax credit</p>
          <p className="text-lg font-bold text-canvas-text">{formatPaise(sample.taxCreditPaise)}</p>
        </div>
      </div>

      {mode === 'munshi' && (
        <p className="mt-3 text-sm text-slate-300">
          Partner view: 30% of the sample check fee is {formatPaise(applyBps(sample.feePaise, 3000))}. Live client files are not connected yet.
        </p>
      )}

      <p className="mt-3 text-xs leading-relaxed text-slate-400">{sample.note}</p>
    </div>
  );
}
