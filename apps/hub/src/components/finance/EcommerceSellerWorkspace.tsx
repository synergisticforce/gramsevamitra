import { useState } from 'react';
import { formatOwnerAmount } from '../../lib/audit/ownerExperience';
import { useDisplayPrefs } from '../../lib/audit/useDisplayPrefs';

interface SellerView {
  platform: string;
  items: Array<Record<string, unknown>>;
  findings: Array<Record<string, unknown>>;
  tax: Record<string, unknown>;
  declaredPaise: number;
  settledPaise: number;
}

function sampleView(): SellerView {
  return {
    platform: 'FLIPKART',
    declaredPaise: 167180,
    settledPaise: 167180,
    items: [
      {
        orderId: 'OD-1',
        orderItemId: 'IT-1',
        sku: 'SAREE',
        grossSalePaise: 200000,
        marketplaceCommissionPaise: 20000,
        forwardShippingFeePaise: 2000,
        gstOnFees18PctPaise: 3960,
        tcsSec52Paise: 200,
        tds194OPaise: 20,
        declaredSettledPaise: 40000,
        billedWeightGrams: 450,
      },
      {
        orderId: 'OD-5',
        orderItemId: 'IT-5',
        sku: 'SAREE',
        grossSalePaise: 200000,
        marketplaceCommissionPaise: 20000,
        forwardShippingFeePaise: 32820,
        gstOnFees18PctPaise: 9508,
        tcsSec52Paise: 200,
        tds194OPaise: 20,
        declaredSettledPaise: 7180,
        billedWeightGrams: 1000,
      },
    ],
    findings: [
      {
        findingType: 'SKU_WEIGHT_OR_SHIPPING_OVERCHARGE',
        sku: 'SAREE',
        orderId: 'OD-5',
        recoverableVariancePaise: 30820,
        sourceRowNumber: 6,
      },
    ],
    tax: {
      gstr2bInputTaxCredit18PctPaise: 13468,
      gstr8TcsSec52Paise: 400,
      form26asTds194OPaise: 40,
    },
  };
}

function n(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 0;
}

function parseWeightMap(text: string) {
  const map: Record<string, number> = {};
  for (const line of text.split(/\n+/)) {
    const [sku, grams] = line.split(',').map((part) => part.trim());
    if (!sku || !grams || Number.isNaN(Number(grams))) continue;
    map[sku] = Math.round(Number(grams));
  }
  return map;
}

export default function EcommerceSellerWorkspace() {
  const prefs = useDisplayPrefs();
  const money = (paise: number) => formatOwnerAmount(paise, prefs.indic);
  const [view, setView] = useState<SellerView | null>(null);
  const [weights, setWeights] = useState('SAREE, 450');
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');

  const runFile = async (nextFile: File, weightText: string) => {
    const { auditUploadedWorkbook } = await import('../../lib/audit/adapters/registry');
    const parsed = await auditUploadedWorkbook(new Uint8Array(await nextFile.arrayBuffer()), nextFile.name, {
      commissionBps: null,
      categoryCommissionBps: null,
      skuWeightMapGrams: parseWeightMap(weightText),
      approvedDiscountShareBps: 10000,
      approvedWeeklyAdCapPaise: 100000000,
    });
    const items = Array.isArray(parsed.statement.items) ? parsed.statement.items : [];
    const settledPaise = items.reduce((sum: number, item: { declaredSettledPaise?: number }) => sum + n(item.declaredSettledPaise), 0);
    setView({
      platform: String(parsed.statement.platform || 'Seller'),
      items: items as Array<Record<string, unknown>>,
      findings: (parsed.auditResult.findings || []) as Array<Record<string, unknown>>,
      tax: parsed.taxPackage as unknown as Record<string, unknown>,
      declaredPaise: n(parsed.statement.declaredSummaryNetPayoutPaise),
      settledPaise,
    });
  };

  return (
    <section className="px-4 py-6 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-black">Seller hub</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Meesho, Flipkart settlement, Amazon, and Shopify cash-on-delivery. The order-item waterfall, weight slab, and tax cards stay on this device.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <label className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white">
            Choose Excel, CSV, or PDF
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.pdf"
              className="sr-only"
              onChange={(event) => {
                const picked = event.target.files?.[0];
                if (!picked) return;
                setFile(picked);
                void runFile(picked, weights).catch((err) => setNote(err instanceof Error ? err.message : 'This file could not be read.'));
                event.target.value = '';
              }}
            />
          </label>
          <button type="button" className="rounded-xl border border-slate-500 px-4 py-3 text-sm font-bold" onClick={() => setView(sampleView())}>
            Try Flipkart sample
          </button>
        </div>
        <label className="mt-4 block text-sm font-bold">
          SKU weight override (SKU, Weight_Grams)
          <textarea
            className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-950 p-3 font-mono text-sm"
            rows={3}
            value={weights}
            onChange={(event) => setWeights(event.target.value)}
          />
        </label>
        {file && (
          <button
            type="button"
            className="mt-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-900"
            onClick={() => void runFile(file, weights).catch((err) => setNote(err instanceof Error ? err.message : 'This file could not be read.'))}
          >
            Re-check with these weights
          </button>
        )}
        {note && <p className="mt-3 text-sm text-rose-300">{note}</p>}
        {view && (
          <div className="mt-6 space-y-4">
            <h2 className="text-xl font-black">{view.platform}</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <article className="rounded-2xl bg-slate-900 p-4">
                <p className="text-xs font-bold uppercase">GSTR-2B 18% ITC</p>
                <p className="text-2xl font-black">{money(n(view.tax.gstr2bInputTaxCredit18PctPaise))}</p>
              </article>
              <article className="rounded-2xl bg-slate-900 p-4">
                <p className="text-xs font-bold uppercase">GSTR-8 TCS</p>
                <p className="text-2xl font-black">{money(n(view.tax.gstr8TcsSec52Paise))}</p>
              </article>
              <article className="rounded-2xl bg-slate-900 p-4">
                <p className="text-xs font-bold uppercase">Form 26AS TDS</p>
                <p className="text-2xl font-black">{money(n(view.tax.form26asTds194OPaise))}</p>
              </article>
            </div>
            <article className="rounded-2xl border border-slate-700 p-4">
              <h3 className="font-black">Multi-sheet NEFT bridge</h3>
              <p className="mt-2">Settled order items {money(view.settledPaise)}</p>
              <p>Declared bank figure {money(view.declaredPaise)}</p>
              <p className="font-bold">{view.settledPaise === view.declaredPaise ? 'Bridge matches' : 'Bridge does not match'}</p>
            </article>
            <article className="rounded-2xl border border-amber-700 p-4">
              <h3 className="font-black">SKU weight and zone inspector</h3>
              <ul className="mt-2 space-y-2">
                {view.findings.filter((finding) => String(finding.findingType || '').includes('WEIGHT') || String(finding.findingType || '').includes('SHIP')).map((finding) => (
                  <li key={`${finding.orderId}-${finding.sku}`}>
                    {String(finding.sku || finding.orderId)} · {money(n(finding.recoverableVariancePaise))}
                  </li>
                ))}
                {view.findings.every((finding) => !String(finding.findingType || '').includes('WEIGHT') && !String(finding.findingType || '').includes('SHIP')) && (
                  <li>No weight-slab difference on this file.</li>
                )}
              </ul>
            </article>
            <article className="overflow-x-auto rounded-2xl border border-slate-700">
              <h3 className="px-4 pt-4 font-black">Order-item waterfall</h3>
              <table className="mt-2 min-w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-slate-400">
                    <th className="px-3 py-2">Order</th>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Sale</th>
                    <th className="px-3 py-2">Commission</th>
                    <th className="px-3 py-2">Ship</th>
                    <th className="px-3 py-2">Weight</th>
                    <th className="px-3 py-2">Settled</th>
                  </tr>
                </thead>
                <tbody>
                  {view.items.map((item) => (
                    <tr key={`${item.orderId}-${item.orderItemId}`} className="border-t border-slate-800">
                      <td className="px-3 py-2">{String(item.orderId || '')}</td>
                      <td className="px-3 py-2">{String(item.sku || '')}</td>
                      <td className="px-3 py-2">{money(n(item.grossSalePaise))}</td>
                      <td className="px-3 py-2">{money(n(item.marketplaceCommissionPaise))}</td>
                      <td className="px-3 py-2">{money(n(item.forwardShippingFeePaise))}</td>
                      <td className="px-3 py-2">{n(item.billedWeightGrams)} g</td>
                      <td className="px-3 py-2">{money(n(item.declaredSettledPaise))}</td>
                    </tr>
                  ))}
                  {view.items.length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-slate-400" colSpan={7}>This statement has no order-item rows.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </article>
          </div>
        )}
      </div>
    </section>
  );
}
