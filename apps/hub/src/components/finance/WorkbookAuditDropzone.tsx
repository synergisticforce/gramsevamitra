import { useEffect, useState } from 'react';
import { apiUrl } from '../../shared/lib/apiBase';
import { formatMinorUnits } from '../../lib/audit/currency';
import type { CellVerificationQueueItem } from '../../lib/audit/selfHealingCrop';

interface LiveAudit {
  platform: string;
  recoverablePaise: number;
  yoursPaise: number;
  feePaise: number;
  isUnlocked: boolean;
  findings: Array<{
    type: string;
    orderId: string;
    variancePaise: number;
    ticket: string;
    isSampleProof: boolean;
    isMasked: boolean;
  }>;
  taxLines: Array<{ label: string; paise: number }>;
}

interface AuditSession {
  statement: Record<string, unknown>;
  contract: Record<string, unknown>;
  queue: CellVerificationQueueItem[];
  unmaskedAudit: Record<string, unknown>;
  taxPackage: Record<string, unknown>;
  uploadId: string;
  view: LiveAudit;
}

function paiseToRupeeInput(paise: number): string {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(paise));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

function viewFromMasked(
  platform: string,
  masked: {
    findings?: Array<Record<string, unknown>>;
    totalRecoverablePaise?: number;
    ownerPocketPaise?: number;
    unlockFeePaise?: number;
    isUnlocked?: boolean;
  },
  tax: Record<string, unknown>,
): LiveAudit {
  const findings = masked.findings || [];
  return {
    platform,
    recoverablePaise: Number(masked.totalRecoverablePaise || 0),
    yoursPaise: Number(masked.ownerPocketPaise || 0),
    feePaise: Number(masked.unlockFeePaise || 0),
    isUnlocked: masked.isUnlocked === true,
    findings: findings.slice(0, 8).map((finding) => ({
      type: String(finding.findingType || ''),
      orderId: String(finding.orderId || ''),
      variancePaise: Number(finding.recoverableVariancePaise || 0),
      ticket: String(finding.claimTicketEn || ''),
      isSampleProof: finding.isSampleProof === true,
      isMasked: finding.isMasked === true,
    })),
    taxLines: [
      { label: 'GSTR-2B 18% fee GST', paise: Number(tax.gstr2bInputTaxCredit18PctPaise || 0) },
      { label: 'Form 26AS 194-O', paise: Number(tax.form26asTds194OPaise || 0) },
      { label: 'GSTR-8 Section 52 TCS', paise: Number(tax.gstr8TcsSec52Paise || 0) },
      { label: 'Section 9(5) pass-through', paise: Number(tax.section95PassThroughGstPaise || 0) },
    ],
  };
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const teaserContract = {
  commissionBps: null,
  categoryCommissionBps: null,
  approvedDiscountShareBps: 10000,
  approvedWeeklyAdCapPaise: 100000000,
};

export default function WorkbookAuditDropzone({ mode = 'owner' }: { mode?: 'owner' | 'seller' | 'munshi' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [session, setSession] = useState<AuditSession | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [partnerWallet, setPartnerWallet] = useState('');

  useEffect(() => {
    if (mode !== 'munshi') return;
    void fetch(apiUrl('/api/audit/munshi-dashboard?munshiId=desk'))
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { commissionWalletPaise?: number } | null) => {
        if (!payload) return;
        setPartnerWallet(formatMinorUnits(Number(payload.commissionWalletPaise || 0)));
      })
      .catch(() => undefined);
  }, [mode]);

  const rememberUpload = (statement: Record<string, unknown>, munshiId: string | null) => {
    void fetch(apiUrl('/api/audit/upload'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statement, contract: teaserContract, munshiId, tenantName: statement.outletName || 'Outlet' }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { uploadId?: string } | null) => {
        if (!payload?.uploadId) return;
        setSession((current) => (current ? { ...current, uploadId: payload.uploadId || '' } : current));
      })
      .catch(() => undefined);
  };

  const adopt = (
    statement: Record<string, unknown>,
    unmaskedAudit: Record<string, unknown>,
    taxPackage: Record<string, unknown>,
    queue: CellVerificationQueueItem[],
    masked: {
      findings?: Array<Record<string, unknown>>;
      totalRecoverablePaise?: number;
      ownerPocketPaise?: number;
      unlockFeePaise?: number;
      isUnlocked?: boolean;
    },
  ) => {
    const nextDrafts: Record<string, string> = {};
    for (const item of queue) nextDrafts[`${item.orderId}:${item.columnName}`] = paiseToRupeeInput(Number(item.expectedPaise));
    setDrafts(nextDrafts);
    setSession({
      statement,
      contract: teaserContract,
      queue,
      unmaskedAudit,
      taxPackage,
      uploadId: '',
      view: viewFromMasked(String(statement.platform || 'Statement'), masked, taxPackage),
    });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError('');
    setNote('');
    setSession(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        const { extractDigitalPdfRowsOrEscalate } = await import('../../lib/audit/pdfRouter');
        const digital = await extractDigitalPdfRowsOrEscalate(bytes);
        if (digital.mode === 'DIGITAL_EXTRACTED') {
          const rowCount = digital.rows?.length ?? 0;
          setNote(`Digital PDF read on this device: ${rowCount} rows. ₹0 charged.`);
          return;
        }
        const body = new FormData();
        body.append('file', file);
        const response = await fetch(apiUrl('/api/audit/ocr-extract'), { method: 'POST', body });
        const payload = (await response.json()) as { success?: boolean; message?: string; rows?: unknown[]; provider?: string };
        if (!response.ok || !payload.success) {
          setError(payload.message || 'This scan could not be read.');
          return;
        }
        setNote(`Cloud reading returned ${(payload.rows || []).length} rows${payload.provider ? ` via ${payload.provider}` : ''}.`);
        return;
      }

      const { auditUploadedWorkbook } = await import('../../lib/audit/adapters/registry');
      const { inspectAndQueueOcrDiscrepancies } = await import('../../lib/audit/selfHealingCrop');
      const { applyFreemiumTeaserMask } = await import('../../lib/audit/unlockEngine');
      const parsed = await auditUploadedWorkbook(bytes, file.name, teaserContract);
      const munshiId = mode === 'munshi' ? 'desk' : null;
      const inspected = inspectAndQueueOcrDiscrepancies(parsed.statement, parsed.auditResult, { munshiId });
      const unmasked = parsed.auditResult as Record<string, unknown>;
      const masked = applyFreemiumTeaserMask(unmasked);
      adopt(inspected.statement, unmasked, parsed.taxPackage as Record<string, unknown>, inspected.queue, masked);
      rememberUpload(inspected.statement, munshiId);
    } catch (err) {
      setSession(null);
      setError(err instanceof Error ? err.message : 'This file could not be read.');
    } finally {
      setBusy(false);
    }
  };

  const showTeaserSample = async () => {
    setBusy(true);
    setError('');
    setNote('Sample only. These three rows are not from a payout file.');
    try {
      const { applyFreemiumTeaserMask } = await import('../../lib/audit/unlockEngine');
      const { buildTaxAutopilotPackage } = await import('../../lib/audit/taxAutopilot');
      const statement = {
        platform: 'SWIGGY',
        vertical: 'RESTAURANT',
        outletName: 'Sample outlet',
        payoutCycleStart: '2026-11-01',
        payoutCycleEnd: '2026-11-07',
        declaredSummaryNetPayoutPaise: 100000,
        orders: [],
        outletAdjustments: [],
        heldOrders: [{ orderId: 'HELD-1', amountPaise: 42000, reason: 'Unresolved customer complaint' }],
      };
      const audit = {
        totalRecoverablePaise: 450000,
        findings: [
          {
            findingType: 'COMMISSION_RATE_OVERCHARGE',
            orderId: '1849000029',
            orderItemId: 'ITEM10001',
            sku: 'MEAL',
            recoverableVariancePaise: 150000,
            expectedPaise: 8400,
            billedPaise: 158400,
            claimTicketEn: 'Commission on 1849000029 is above the contract.',
            claimTicketHi: 'कमीशन अधिक है।',
            sourceTabName: 'Order Level',
            sourceRowNumber: 6,
            deductionBucket: 'CONTRACT_FEE',
          },
          {
            findingType: 'SKU_WEIGHT_OR_SHIPPING_OVERCHARGE',
            orderId: '5521000088',
            orderItemId: 'ITEM10002',
            recoverableVariancePaise: 150000,
            expectedPaise: 2000,
            billedPaise: 152000,
            claimTicketEn: 'Shipping on 5521000088 is above the slab.',
            claimTicketHi: 'शिपिंग अधिक है।',
            sourceTabName: 'Orders',
            sourceRowNumber: 12,
            deductionBucket: 'LOGISTICS_OVERCHARGE',
          },
          {
            findingType: 'EXCESS_OR_UNCONSENTED_AD_SPEND',
            orderId: '7731000044',
            orderItemId: 'ITEM10003',
            recoverableVariancePaise: 150000,
            expectedPaise: 0,
            billedPaise: 150000,
            claimTicketEn: 'Ads on 7731000044 were not approved.',
            claimTicketHi: 'विज्ञापन स्वीकृत नहीं था।',
            sourceTabName: 'Ads',
            sourceRowNumber: 4,
            deductionBucket: 'CONTESTIBLE_CUT',
          },
        ],
      };
      const tax = buildTaxAutopilotPackage(statement, audit) as unknown as Record<string, unknown>;
      adopt(statement, audit, tax, [], applyFreemiumTeaserMask(audit));
    } finally {
      setBusy(false);
    }
  };

  const unlockAll = async () => {
    if (!session) return;
    const { applyFreemiumTeaserMask } = await import('../../lib/audit/unlockEngine');
    const opened = applyFreemiumTeaserMask(session.unmaskedAudit, { forceUnlocked: true });
    setSession({
      ...session,
      view: viewFromMasked(session.view.platform, opened, session.taxPackage),
    });
    if (!session.uploadId) return;
    void fetch(apiUrl('/api/audit/unlock'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadId: session.uploadId }),
    }).catch(() => undefined);
  };

  const prepareMandate = async () => {
    if (!session?.uploadId) {
      setNote('This check is open on this device. The ₹1 mandate is created when the audit API is connected.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(apiUrl('/api/audit/create-unlock-checkout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId: session.uploadId, mode: 'TRUST_CLOCK_MANDATE' }),
      });
      const payload = (await response.json()) as { success?: boolean; message?: string; checkout?: { authAmountPaise?: number; maxAmountPaise?: number } };
      if (!response.ok || !payload.success) {
        setNote(payload.message || 'The mandate could not be prepared from this preview.');
        return;
      }
      setNote(
        `UPI authorisation ${formatMinorUnits(Number(payload.checkout?.authAmountPaise || 100))}. Mandate ceiling ${formatMinorUnits(Number(payload.checkout?.maxAmountPaise || session.view.feePaise))}. The fee is collected on day 14 if you keep the claim.`,
      );
    } catch {
      setNote('The mandate could not be prepared from this preview.');
    } finally {
      setBusy(false);
    }
  };

  const downloadPack = async () => {
    if (!session?.view.isUnlocked) return;
    const { buildEvidencePackWorkbook } = await import('../../lib/audit/evidencePack');
    const pack = buildEvidencePackWorkbook(session.statement, session.unmaskedAudit, session.taxPackage);
    downloadBlob('evidence-pack.xlsx', new Blob([pack.bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  };

  const downloadTax = (kind: 'csv' | 'xml') => {
    if (!session?.view.isUnlocked) return;
    const text = String(kind === 'csv' ? session.taxPackage.tallyJournalCsv || '' : session.taxPackage.tallyVoucherXml || '');
    downloadBlob(kind === 'csv' ? 'tally-journal.csv' : 'tally-voucher.xml', new Blob([text], { type: kind === 'csv' ? 'text/csv' : 'application/xml' }));
  };

  const confirmCell = async (item: CellVerificationQueueItem) => {
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      const { resolveCellVerification } = await import('../../lib/audit/selfHealingCrop');
      const { buildTaxAutopilotPackage } = await import('../../lib/audit/taxAutopilot');
      const { applyFreemiumTeaserMask } = await import('../../lib/audit/unlockEngine');
      const key = `${item.orderId}:${item.columnName}`;
      const corrected = item.assignedToRole === 'ADMIN' ? paiseToRupeeInput(item.expectedPaise) : drafts[key] || paiseToRupeeInput(item.expectedPaise);
      const healed = resolveCellVerification(session.statement, item, corrected, session.contract);
      const audit = (healed.auditResult || session.unmaskedAudit) as Record<string, unknown>;
      const tax = buildTaxAutopilotPackage(healed.statement, audit) as unknown as Record<string, unknown>;
      const masked = applyFreemiumTeaserMask(audit, { forceUnlocked: session.view.isUnlocked });
      setSession({
        ...session,
        statement: healed.statement,
        unmaskedAudit: audit,
        taxPackage: tax,
        queue: session.queue.map((queued) =>
          queued.orderId === item.orderId && queued.columnName === item.columnName ? healed.queueItem : queued,
        ),
        view: viewFromMasked(String(healed.statement.platform || session.view.platform), masked, tax),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That cell could not be updated.');
    } finally {
      setBusy(false);
    }
  };

  const result = session?.view || null;
  const openQueue = (session?.queue || []).filter((item) => item.status !== 'RESOLVED');

  return (
    <div className="mb-6 rounded-2xl border border-dashed border-canvas-border bg-canvas-surface p-4 sm:p-5">
      <h2 className="text-lg font-bold text-canvas-text">Check a payout file</h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-300">
        Drop a Swiggy, Zomato, Meesho, Flipkart, Amazon, or Shopify Excel, CSV, or PDF. Spreadsheets are read on this device. Customer name, phone, and address columns are removed before the check. A find under ₹200 opens in full. A larger find shows one proof row until you unlock it.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <label className="inline-flex cursor-pointer rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white">
          {busy ? 'Reading…' : 'Choose Excel, CSV, or PDF'}
          <input
            type="file"
            accept=".xlsx,.xls,.csv,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="sr-only"
            onChange={(event) => {
              void onFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </label>
        <button type="button" className="rounded-xl border border-canvas-border px-4 py-3 text-sm font-semibold text-slate-100" onClick={() => void showTeaserSample()}>
          Preview a ₹4,500 teaser
        </button>
      </div>
      {partnerWallet && <p className="mt-3 text-sm text-slate-300">Munshi commission wallet {partnerWallet}</p>}
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      {note && <p className="mt-3 text-sm text-slate-200">{note}</p>}
      {openQueue.map((item) => (
        <form
          key={`${item.orderId}:${item.columnName}`}
          className="mt-4 rounded-2xl border border-amber-600/50 bg-amber-950/30 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void confirmCell(item);
          }}
        >
          <p className="text-sm font-semibold text-amber-100">One number needs a look</p>
          <p className="mt-1 text-sm text-amber-50">
            Order {item.orderId} read {formatMinorUnits(item.extractedPaise)}. The row balances if this cell is{' '}
            {formatMinorUnits(item.expectedPaise)}.
          </p>
          {item.assignedToRole === 'MUNSHI' && (
            <label className="mt-3 block text-xs font-semibold uppercase text-amber-200">
              Correct amount
              <input
                className="mt-1 w-full rounded-xl border border-amber-700/60 bg-canvas-bg px-3 py-2 text-base text-white"
                inputMode="decimal"
                value={drafts[`${item.orderId}:${item.columnName}`] || ''}
                onChange={(event) =>
                  setDrafts((current) => ({ ...current, [`${item.orderId}:${item.columnName}`]: event.target.value }))
                }
              />
            </label>
          )}
          <button type="submit" className="mt-3 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-amber-950">
            Confirm {formatMinorUnits(item.expectedPaise)}
          </button>
        </form>
      ))}
      {result && (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-semibold text-canvas-text">{result.platform}</p>
          <p className="text-3xl font-bold text-canvas-text">Total found {formatMinorUnits(result.recoverablePaise)}</p>
          <p className="text-sm text-slate-300">
            {result.isUnlocked
              ? result.feePaise === 0
                ? 'This check is open. There is no unlock fee.'
                : 'All claim rows are open.'
              : 'One proof row is open. The other order ids stay hidden until you unlock them.'}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-700/40 bg-emerald-950/40 p-4">
              <p className="text-xs font-semibold uppercase text-emerald-200">Your pocket</p>
              <p className="text-2xl font-bold text-white">{formatMinorUnits(result.yoursPaise)}</p>
            </div>
            <div className="rounded-2xl border border-sky-700/40 bg-sky-950/40 p-4">
              <p className="text-xs font-semibold uppercase text-sky-200">Unlock fee</p>
              <p className="text-2xl font-bold text-white">{formatMinorUnits(result.feePaise)}</p>
            </div>
          </div>
          <ul className="space-y-2 text-sm text-slate-200">
            {result.findings.map((finding, index) => (
              <li key={`${finding.orderId}-${finding.variancePaise}-${index}`}>
                {finding.isSampleProof ? 'Proof row · ' : ''}
                {finding.type.replaceAll('_', ' ')} {finding.orderId} {formatMinorUnits(finding.variancePaise)}
                {finding.isMasked ? ' · hidden until unlock' : ''}
              </li>
            ))}
            {result.findings.length === 0 && <li>No recoverable difference on this file.</li>}
          </ul>
          {!result.isUnlocked && (
            <div className="flex flex-wrap gap-3">
              <button type="button" className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white" onClick={() => void unlockAll()}>
                Unlock All Claims
              </button>
              <button type="button" className="rounded-xl border border-canvas-border px-4 py-3 text-sm font-semibold text-slate-100" onClick={() => void prepareMandate()}>
                Prepare ₹1 UPI mandate
              </button>
            </div>
          )}
          {result.isUnlocked && (
            <div className="flex flex-wrap gap-3">
              <button type="button" className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white" onClick={() => void downloadPack()}>
                Download 4-Tab Evidence Pack (.xlsx)
              </button>
              <button type="button" className="rounded-xl border border-canvas-border px-4 py-3 text-sm font-semibold text-slate-100" onClick={() => downloadTax('csv')}>
                Download Tally CSV
              </button>
              <button type="button" className="rounded-xl border border-canvas-border px-4 py-3 text-sm font-semibold text-slate-100" onClick={() => downloadTax('xml')}>
                Download Tally XML
              </button>
            </div>
          )}
          <ul className="text-sm text-slate-300">
            {result.taxLines.map((line) => (
              <li key={line.label}>
                {line.label}: {formatMinorUnits(line.paise)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
