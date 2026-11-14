import { useEffect, useState } from 'react';
import { formatOwnerAmount, ownerCopy, whatsAppShareUrl, buildOwnerWhatsAppMessage } from '../../lib/audit/ownerExperience';
import { useDisplayPrefs } from '../../lib/audit/useDisplayPrefs';
import { buildCompliantUnlockCheckout } from '../../lib/audit/unlockEngine';

type View = 'intake' | 'reject' | 'money' | 'clean' | 'unlocked';

interface OwnerCase {
  platform: string;
  totalPaise: number;
  yoursPaise: number;
  feePaise: number;
  heldPaise: number;
  heldCount: number;
  utr: string;
  taxCreditPaise: number;
  proofOrderId: string;
  proofRow: number;
  proofVariancePaise: number;
  tickets: string[];
  statement: Record<string, unknown>;
  audit: Record<string, unknown>;
  tax: Record<string, unknown>;
}

const contract = {
  commissionBps: null,
  approvedDiscountShareBps: 10000,
  approvedWeeklyAdCapPaise: 100000000,
};

function swiggyCase(): OwnerCase {
  const findings = [
    {
      findingType: 'COMMISSION_RATE_OVERCHARGE',
      orderId: '1849000029',
      recoverableVariancePaise: 150000,
      expectedPaise: 8400,
      billedPaise: 158400,
      claimTicketEn: 'Commission on 1849000029 is above the contract.',
      claimTicketHi: 'ऑर्डर 1849000029 पर कमीशन तय दर से अधिक है।',
      sourceTabName: 'Order Level',
      sourceRowNumber: 6,
      deductionBucket: 'CONTRACT_FEE',
    },
    {
      findingType: 'SKU_WEIGHT_OR_SHIPPING_OVERCHARGE',
      orderId: '5521000088',
      recoverableVariancePaise: 150000,
      expectedPaise: 2000,
      billedPaise: 152000,
      claimTicketEn: 'Shipping on 5521000088 is above the slab.',
      claimTicketHi: 'ऑर्डर 5521000088 पर शिपिंग अधिक है।',
      sourceTabName: 'Orders',
      sourceRowNumber: 12,
      deductionBucket: 'LOGISTICS_OVERCHARGE',
    },
    {
      findingType: 'EXCESS_OR_UNCONSENTED_AD_SPEND',
      orderId: '7731000044',
      recoverableVariancePaise: 150000,
      expectedPaise: 0,
      billedPaise: 150000,
      claimTicketEn: 'Ads on 7731000044 were not approved.',
      claimTicketHi: 'ऑर्डर 7731000044 का विज्ञापन स्वीकृत नहीं था।',
      sourceTabName: 'Ads',
      sourceRowNumber: 4,
      deductionBucket: 'CONTESTIBLE_CUT',
    },
  ];
  return {
    platform: 'SWIGGY',
    totalPaise: 450000,
    yoursPaise: 405000,
    feePaise: 45000,
    heldPaise: 42000,
    heldCount: 1,
    utr: 'HDFCNEFT4500',
    taxCreditPaise: 3690,
    proofOrderId: '1849000029',
    proofRow: 6,
    proofVariancePaise: 150000,
    tickets: findings.map((finding) => finding.claimTicketHi),
    statement: {
      platform: 'SWIGGY',
      outletName: 'Sample kitchen',
      payoutCycleStart: '2026-11-01',
      payoutCycleEnd: '2026-11-07',
      declaredSummaryNetPayoutPaise: 100000,
      orders: [{ declaredOrderPayoutPaise: 120000 }],
      outletAdjustments: [
        { kind: 'ADDITION', settledThisCyclePaise: 5000 },
        { kind: 'DEDUCTION', settledThisCyclePaise: 25000 },
      ],
      heldOrders: [{ orderId: 'HELD-1', amountPaise: 42000, reason: 'Unresolved customer complaint' }],
    },
    audit: { totalRecoverablePaise: 450000, findings },
    tax: {
      gstr2bInputTaxCredit18PctPaise: 3690,
      form26asTds194OPaise: 420,
      gstr8TcsSec52Paise: 0,
      section95PassThroughGstPaise: 0,
      tallyJournalCsv: 'Voucher Type,Ledger,Debit,Credit',
      tallyVoucherXml: '<ENVELOPE></ENVELOPE>',
    },
  };
}

function zomatoClean(): OwnerCase {
  return {
    platform: 'ZOMATO',
    totalPaise: 0,
    yoursPaise: 0,
    feePaise: 0,
    heldPaise: 0,
    heldCount: 0,
    utr: 'ICICINEFT0000',
    taxCreditPaise: 3124,
    proofOrderId: '',
    proofRow: 0,
    proofVariancePaise: 0,
    tickets: [],
    statement: {
      platform: 'ZOMATO',
      outletName: 'Sample kitchen',
      payoutCycleStart: '2026-11-01',
      payoutCycleEnd: '2026-11-07',
      declaredBankUtrPaise: 0,
      declaredSummaryNetPayoutPaise: 0,
      orders: [],
      outletAdjustments: [],
      heldOrders: [],
    },
    audit: { totalRecoverablePaise: 0, findings: [] },
    tax: {
      gstr2bInputTaxCredit18PctPaise: 2800,
      form26asTds194OPaise: 324,
      gstr8TcsSec52Paise: 0,
      section95PassThroughGstPaise: 0,
      tallyJournalCsv: 'Voucher Type,Ledger,Debit,Credit',
      tallyVoucherXml: '<ENVELOPE></ENVELOPE>',
    },
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

export default function OwnerVisualPWA() {
  const prefs = useDisplayPrefs();
  const copy = ownerCopy(prefs.hindi ? 'hi' : 'en');
  const money = (paise: number) => formatOwnerAmount(paise, prefs.indic);
  const [view, setView] = useState<View>('intake');
  const [current, setCurrent] = useState<OwnerCase | null>(null);
  const [modal, setModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState('');

  const openCase = (next: OwnerCase) => {
    setCurrent(next);
    setModal(false);
    setCopied(false);
    if (next.totalPaise <= 0) setView('clean');
    else if (next.totalPaise < 20000) setView('unlocked');
    else setView('money');
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setNote('');
    try {
      const { auditUploadedWorkbook } = await import('../../lib/audit/adapters/registry');
      const { applyFreemiumTeaserMask } = await import('../../lib/audit/unlockEngine');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const parsed = await auditUploadedWorkbook(bytes, file.name, contract);
      const masked = applyFreemiumTeaserMask(parsed.auditResult as Record<string, unknown>);
      const findings = (masked.findings || []) as Array<Record<string, unknown>>;
      const proof = findings[0];
      const held = Array.isArray(parsed.statement.heldOrders) ? parsed.statement.heldOrders : [];
      const heldPaise = held.reduce((sum: number, order: { amountPaise?: number }) => sum + Number(order.amountPaise || 0), 0);
      const total = Number(masked.totalRecoverablePaise || 0);
      openCase({
        platform: String(parsed.statement.platform || 'Payout'),
        totalPaise: total,
        yoursPaise: Number(masked.ownerPocketPaise || 0),
        feePaise: Number(masked.unlockFeePaise || 0),
        heldPaise,
        heldCount: held.length,
        utr: String(parsed.statement.bankUtr || parsed.statement.declaredSummaryNetPayoutPaise || ''),
        taxCreditPaise:
          Number(parsed.taxPackage.gstr2bInputTaxCredit18PctPaise || 0) +
          Number(parsed.taxPackage.form26asTds194OPaise || 0),
        proofOrderId: String(proof?.orderId || ''),
        proofRow: Number(proof?.sourceRowNumber || 0),
        proofVariancePaise: Number(proof?.recoverableVariancePaise || 0),
        tickets: findings.map((finding) => String(finding.claimTicketHi || finding.claimTicketEn || '')).filter(Boolean),
        statement: parsed.statement,
        audit: parsed.auditResult as Record<string, unknown>,
        tax: parsed.taxPackage as unknown as Record<string, unknown>,
      });
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
      if (code === 'BOUNCER') {
        setView('reject');
        return;
      }
      // Never surface stack traces or raw engine errors to rural owners.
      const message = err instanceof Error ? err.message : '';
      const safe =
        message && message.length < 160 && !/at\s+\S+|Error:|TypeError|stack/i.test(message)
          ? message
          : 'This file could not be read. Try the Excel or CSV from the Partner App.';
      setNote(safe);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('shared') !== '1') return;
    let cancelled = false;
    (async () => {
      try {
        const cache = await caches.open('gsm-share');
        const cached = await cache.match('/shared-payout-file');
        if (!cached || cancelled) return;
        const blob = await cached.blob();
        const encodedName = cached.headers.get('X-File-Name') || '';
        let name = 'payout.xlsx';
        try {
          name = decodeURIComponent(encodedName) || name;
        } catch {
          name = encodedName || name;
        }
        const file = new File([blob], name, { type: blob.type || 'application/octet-stream' });
        await cache.delete('/shared-payout-file');
        if (!cancelled) await onFile(file);
        const clean = new URL(window.location.href);
        clean.searchParams.delete('shared');
        window.history.replaceState({}, '', clean.pathname + clean.search);
      } catch {
        if (!cancelled) setNote('The shared file could not be opened. Tap the green box and pick it again.');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on share_target landing
  }, []);

  const checkout = current
    ? buildCompliantUnlockCheckout('owner-preview', current.feePaise, 'TRUST_CLOCK_MANDATE')
    : null;

  const shareHref = current
    ? whatsAppShareUrl(
        buildOwnerWhatsAppMessage({
          platform: current.platform,
          totalRecoverablePaise: current.totalPaise,
          ownerPocketPaise: current.yoursPaise,
          unlockFeePaise: current.feePaise,
          tickets: current.tickets,
        }),
      )
    : 'https://wa.me/?text=GramSevaMitra';

  const copyTicket = async () => {
    const text = current?.tickets.join('\n') || '';
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setNote(text);
    }
  };

  const downloadPack = async () => {
    if (!current) return;
    const { buildEvidencePackWorkbook } = await import('../../lib/audit/evidencePack');
    const pack = buildEvidencePackWorkbook(current.statement, current.audit, current.tax);
    downloadBlob(
      'evidence-pack.xlsx',
      new Blob([pack.bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-[#111827]">
      {view === 'intake' && (
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <label
            className="flex min-h-[240px] animate-pulse cursor-pointer flex-col items-center justify-center rounded-3xl bg-[#16A34A] px-6 text-center text-white shadow-lg"
            aria-label={copy.upload}
          >
            <span className="text-5xl" aria-hidden="true">📤</span>
            <span className="mt-3 text-3xl font-black">{copy.upload}</span>
            <span className="mt-2 text-lg font-bold">.xlsx · .csv · .pdf</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.pdf,application/pdf"
              className="sr-only"
              aria-label={copy.upload}
              onChange={(event) => {
                void onFile(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" className="rounded-2xl bg-white p-4 text-xl font-black shadow" onClick={() => openCase(swiggyCase())}>
              Swiggy
            </button>
            <button type="button" className="rounded-2xl bg-white p-4 text-xl font-black shadow" onClick={() => openCase(zomatoClean())}>
              Zomato
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm font-black">
            <p className="rounded-2xl bg-white p-3">🔒 {copy.safe}</p>
            <p className="rounded-2xl bg-white p-3">🚫🔑 {copy.noPassword}</p>
            <p className="rounded-2xl border border-slate-200 bg-white p-3" data-free-check="ascii">✅ {formatOwnerAmount(0, false)} Free Check</p>
          </div>
          <a className="rounded-2xl bg-[#16A34A] px-4 py-4 text-center text-lg font-black text-white" href={shareHref}>
            WhatsApp
          </a>
          <p className="rounded-2xl bg-white p-4 text-center text-lg font-black">
            1. 📄 File → 2. 📤 Share → 3. 🛡️ GramSevaMitra
          </p>
          {note && <p className="text-center text-lg font-bold text-[#DC2626]">{note}</p>}
        </div>
      )}

      {view === 'reject' && (
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-8 text-center shadow">
          <p className="text-8xl" aria-hidden="true">❌</p>
          <p className="mt-4 text-4xl" aria-hidden="true">📸🐕 🚫 → 📄✅</p>
          <p className="mt-4 text-3xl font-black text-[#DC2626]">{copy.wrongFile} / Wrong File</p>
          <button type="button" className="mt-6 min-h-16 rounded-2xl bg-[#16A34A] px-8 text-2xl font-black text-white" onClick={() => setView('intake')}>
            {copy.tryAgain}
          </button>
        </div>
      )}

      {view === 'money' && current && (
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {current.heldCount > 0 && (
            <div className="animate-pulse rounded-3xl bg-[#D97706] p-5 text-white">
              <p className="text-2xl font-black">⚠️ {money(current.heldPaise)} {copy.held}</p>
              <p className="mt-1 text-lg font-bold">Reply in the Partner App to release it for ₹0.</p>
            </div>
          )}
          <div className="rounded-3xl bg-white p-6 text-center shadow">
            <p className="text-lg font-black">Total found</p>
            <p className="text-6xl font-black">{money(current.totalPaise)}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-3xl bg-[#16A34A] p-4 text-white">
              <p className="text-3xl" aria-hidden="true">👛</p>
              <p className="text-sm font-black">90% {copy.yours}</p>
              <p className="text-3xl font-black">{money(current.yoursPaise)}</p>
            </div>
            <div className="rounded-3xl bg-[#1D4ED8] p-4 text-white">
              <p className="text-3xl" aria-hidden="true">🛡️</p>
              <p className="text-sm font-black">10% {copy.fee}</p>
              <p className="text-3xl font-black">{money(current.feePaise)}</p>
            </div>
          </div>
          <div className="rounded-3xl bg-white p-4 text-xl font-black shadow">
            Order {current.proofOrderId} · Row {current.proofRow} · {money(current.proofVariancePaise)}
          </div>
          <button
            type="button"
            className="min-h-20 rounded-3xl bg-[#111827] text-3xl font-black text-white"
            aria-label={copy.unlock}
            onClick={() => setModal(true)}
          >
            🔓 {copy.unlock}
          </button>
        </div>
      )}

      {view === 'clean' && current && (
        <div className="mx-auto flex max-w-3xl flex-col gap-4 text-center">
          <div className="rounded-3xl bg-[#16A34A] p-8 text-white">
            <p className="text-7xl" aria-hidden="true">🛡️✅</p>
            <p className="mt-3 text-4xl font-black">{money(0)} Loss — 100% Correct</p>
            <p className="mt-2 text-xl font-bold">Bank UTR {current.utr}</p>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow">
            <p className="text-lg font-black">Weekly claimable tax credits</p>
            <p className="text-4xl font-black">{money(current.taxCreditPaise)}</p>
            <p className="mt-1 font-bold">18% GST ITC + 0.1% TDS 194-O</p>
          </div>
          <a href="/workspace/finance/" className="rounded-3xl bg-[#1D4ED8] px-4 py-5 text-2xl font-black text-white">
            ₹299/mo Tax Autopilot
          </a>
          <button type="button" className="font-black" onClick={() => setView('intake')}>{copy.tryAgain}</button>
        </div>
      )}

      {view === 'unlocked' && current && (
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <p className="text-center text-3xl font-black">{money(current.totalPaise)} open</p>
          <a
            className="min-h-20 rounded-3xl bg-[#16A34A] px-4 py-5 text-center text-2xl font-black text-white"
            href={shareHref}
            aria-label={copy.sendMunshi}
          >
            💬 🟢 {copy.sendMunshi}
          </a>
          <button
            type="button"
            className="min-h-20 rounded-3xl bg-[#D97706] px-4 text-2xl font-black text-white"
            aria-label={copy.copyTicket}
            onClick={() => void copyTicket()}
          >
            {copied ? '✅' : '📋 🟠'} {copy.copyTicket}
          </button>
          <button
            type="button"
            className="min-h-20 rounded-3xl bg-white px-4 text-2xl font-black shadow"
            aria-label={copy.download}
            onClick={() => void downloadPack()}
          >
            📥 {copy.download}
          </button>
        </div>
      )}

      {modal && current && checkout && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-xl">
            <p className="text-2xl font-black">Unlock</p>
            <div className="mt-3 rounded-2xl border-2 border-[#D97706] p-4">
              <p className="text-xl font-black">🪙 ₹1 token + 14-day trust clock</p>
              <p className="mt-1 font-bold">Authorise {money(checkout.authAmountPaise || 100)}. Ceiling {money(checkout.maxAmountPaise || current.feePaise)}.</p>
              <p className="mt-2 font-bold">Day 10 reminder → Day 12 pre-debit notice → Day 14 settlement</p>
            </div>
            <div className="mt-3 rounded-2xl border-2 border-[#1D4ED8] p-4">
              <p className="text-xl font-black">🔵 1-tap UPI {money(current.feePaise)}</p>
              <p className="font-bold">14-day rejected-claim fee refund.</p>
            </div>
            <button
              type="button"
              className="mt-4 min-h-16 w-full rounded-2xl bg-[#16A34A] text-2xl font-black text-white"
              onClick={() => {
                setModal(false);
                setView('unlocked');
              }}
            >
              {copy.unlock}
            </button>
            <button type="button" className="mt-2 w-full py-3 font-black" onClick={() => setModal(false)}>
              {copy.tryAgain}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
