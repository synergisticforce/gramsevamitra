import { useEffect, useState } from 'react';
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
  const [clockNote, setClockNote] = useState('');
  const [payouts, setPayouts] = useState<Array<{ id: string; munshi_code: string; upi_id: string; amount_paise: number }>>([]);

  const loadPayouts = async () => {
    try {
      const response = await fetch('/api/audit/munshi-withdraw');
      const data = await response.json();
      setPayouts(Array.isArray(data.requests) ? data.requests : []);
    } catch {
      setPayouts([]);
    }
  };

  useEffect(() => {
    void loadPayouts();
  }, []);

  const runTrustClock = async () => {
    setClockNote('');
    try {
      const response = await fetch('/api/audit/process-trust-clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await response.json();
      setClockNote(data.success ? `Checked. ${Number(data.processed || 0)} mandate(s) are due.` : 'The trust clock check did not finish.');
    } catch {
      setClockNote('The trust clock check did not finish.');
    }
  };

  const settle = async (id: string) => {
    await fetch('/api/audit/munshi-withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'settle', requestId: id }),
    });
    await loadPayouts();
  };

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
        <div className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-4">
          <h2 className="text-xl font-black">14-day trust clock</h2>
          <button type="button" className="mt-3 min-h-12 rounded-xl bg-white px-4 font-black text-slate-950" onClick={() => void runTrustClock()}>
            Run 14-Day Trust Clock Check
          </button>
          {clockNote && <p className="mt-3 font-bold">{clockNote}</p>}
        </div>
        <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-900 p-4">
          <h2 className="text-xl font-black">Munshi UPI withdrawals</h2>
          <ul className="mt-3 space-y-3">
            {payouts.map((payout) => (
              <li key={payout.id} className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">{payout.munshi_code} · {payout.upi_id} · {money(Number(payout.amount_paise || 0))}</p>
                <button type="button" className="min-h-12 rounded-xl bg-emerald-600 px-4 font-black" onClick={() => void settle(payout.id)}>
                  Settle UPI
                </button>
              </li>
            ))}
            {payouts.length === 0 && <li className="text-sm text-slate-400">No pending withdrawals.</li>}
          </ul>
        </div>
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
