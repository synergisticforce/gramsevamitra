import { useState } from 'react';
import CellCheckModal from './CellCheckModal';
import { formatOwnerAmount } from '../../lib/audit/ownerExperience';
import { useDisplayPrefs } from '../../lib/audit/useDisplayPrefs';
import { applyBps } from '../../lib/audit/currency';

interface QueueRow {
  orderId: string;
  extractedPaise: number;
  expectedPaise: number;
  status: string;
}

function misreadRow(): QueueRow {
  return { orderId: 'SW-OCR-1', extractedPaise: 97500, expectedPaise: applyBps(5417, 1800), status: 'NEEDS_VERIFICATION' };
}

export default function AdminCellQueue() {
  const prefs = useDisplayPrefs();
  const money = (paise: number) => formatOwnerAmount(paise, prefs.indic);
  const [rows, setRows] = useState<QueueRow[]>([misreadRow()]);
  const [open, setOpen] = useState<QueueRow | null>(null);
  const [gap, setGap] = useState<number | null>(null);

  const confirm = async (row: QueueRow) => {
    const { resolveCellVerification } = await import('../../lib/audit/selfHealingCrop');
    const net = 50000;
    const service = 5417;
    const tax = applyBps(service, 1800);
    const statement = {
      platform: 'SWIGGY',
      vertical: 'RESTAURANT',
      payoutCycleStart: '2026-11-01',
      payoutCycleEnd: '2026-11-07',
      declaredSummaryNetPayoutPaise: net - service - tax,
      orders: [
        {
          orderId: row.orderId,
          orderStatus: 'DELIVERED',
          itemSubtotalPaise: net,
          netOrderValuePaise: net,
          serviceFeePaise: service,
          taxesOnFees18PctPaise: row.extractedPaise,
          declaredOrderPayoutPaise: net - service - tax,
          sourceTabName: 'Order Level',
          sourceRowNumber: 6,
          ocrConfidenceStatus: 'NEEDS_VERIFICATION',
        },
      ],
      outletAdjustments: [],
      heldOrders: [],
    };
    const healed = resolveCellVerification(
      statement,
      {
        orderId: row.orderId,
        sourceTabName: 'Order Level',
        rowNumber: 6,
        columnName: 'taxesOnFees18PctPaise',
        expectedPaise: row.expectedPaise,
        extractedPaise: row.extractedPaise,
        assignedToRole: 'ADMIN',
        status: 'PENDING',
      },
      '9.75',
      { commissionBps: null, approvedDiscountShareBps: 0, approvedWeeklyAdCapPaise: 100000000 },
    );
    setGap(healed.horizontalGapPaise);
    setRows((current) => current.map((item) => (item.orderId === row.orderId ? { ...item, status: 'VERIFIED', extractedPaise: row.expectedPaise } : item)));
    setOpen(null);
  };

  return (
    <section className="px-4 py-6 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-black">Admin cell queue</h1>
        <p className="mt-2 text-sm text-slate-300">Direct owner uploads with no munshi land here. Confirm the one wrong cell and the row balances again.</p>
        <ul className="mt-4 space-y-3">
          {rows.map((row) => (
            <li key={row.orderId} className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
              <p className="font-bold">{row.orderId}</p>
              <p className="text-sm">Read {money(row.extractedPaise)} · expected {money(row.expectedPaise)} · {row.status}</p>
              {row.status !== 'VERIFIED' && (
                <button type="button" className="mt-3 rounded-xl bg-amber-500 px-4 py-2 font-black text-slate-950" onClick={() => setOpen(row)}>
                  Check this cell
                </button>
              )}
            </li>
          ))}
        </ul>
        {gap === 0 && <p className="mt-4 font-bold text-emerald-300">The row is balanced. Horizontal difference is ₹0.</p>}
      </div>
      {open && (
        <CellCheckModal
          extractedPaise={open.extractedPaise}
          expectedPaise={open.expectedPaise}
          indic={prefs.indic}
          onClose={() => setOpen(null)}
          onConfirm={() => void confirm(open)}
        />
      )}
    </section>
  );
}
