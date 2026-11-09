import * as XLSX from 'xlsx';
import { buildEvidencePackWorkbook, EVIDENCE_PACK_SHEETS } from '../functions/_lib/evidencePack.mjs';
import {
  applyFreemiumTeaserMask,
  buildCompliantUnlockCheckout,
  calculateMunshiCommission,
  processRejectedClaimRefund,
} from '../functions/_lib/unlockEngine.mjs';
import { onRequestPost as uploadAudit } from '../functions/api/audit/upload.js';
import { resetAuditMemory } from '../functions/_lib/auditRepository.mjs';

let failed = 0;

function assert(condition, label) {
  if (!condition) {
    failed += 1;
    console.error(`FAIL ${label}`);
    return;
  }
  console.log(`ok ${label}`);
}

function finding(orderId, variancePaise, ticket) {
  return {
    findingType: 'COMMISSION_RATE_OVERCHARGE',
    orderId,
    orderItemId: `${orderId}-ITEM`,
    sku: 'MEAL',
    recoverableVariancePaise: variancePaise,
    expectedPaise: 100,
    billedPaise: variancePaise + 100,
    claimTicketEn: ticket,
    claimTicketHi: 'हिंदी टिकट',
    sourceTabName: 'Order Level',
    sourceRowNumber: 6,
    deductionBucket: 'CONTRACT_FEE',
  };
}

const small = applyFreemiumTeaserMask({
  totalRecoverablePaise: 15000,
  findings: [finding('SMALL-1', 15000, 'Small ticket')],
});
assert(small.isUnlocked === true, '₹150 finding is unlocked');
assert(small.unlockFeePaise === 0, '₹150 finding has no fee');
assert(small.maskedCount === 0 && small.findings.every((row) => row.isMasked !== true), '₹150 finding has 0 masked rows');

const largeFindings = [
  finding('1849000029', 150000, 'Proof ticket for 1849000029'),
  finding('5521000088', 150000, 'Hidden ticket for 5521000088'),
  finding('7731000044', 150000, 'Hidden ticket for 7731000044'),
];
const large = applyFreemiumTeaserMask({ totalRecoverablePaise: 450000, findings: largeFindings });
assert(large.isUnlocked === false, '₹4,500 audit stays locked');
assert(large.unlockFeePaise === 45000, 'unlock fee is ₹450');
assert(large.ownerPocketPaise === 405000, 'owner pocket is ₹4,050');
assert(large.findings[0].orderId === '1849000029' && large.findings[0].isSampleProof === true, 'finding 1 stays unmasked');
assert(
  large.findings[1].orderId !== '5521000088' &&
    String(large.findings[1].orderId).includes('****') &&
    large.findings[2].orderId !== '7731000044' &&
    String(large.findings[2].orderId).includes('****'),
  'findings 2 and 3 hide the order id',
);
assert(
  large.findings[1].claimTicketEn !== largeFindings[1].claimTicketEn &&
    large.findings[2].claimTicketEn !== largeFindings[2].claimTicketEn,
  'hidden tickets are masked',
);

const mandate = buildCompliantUnlockCheckout('upl_test', 45000, 'TRUST_CLOCK_MANDATE');
assert(mandate.authAmountPaise === 100, 'mandate authorises ₹1');
assert(mandate.maxAmountPaise === 45000, 'mandate ceiling is the unlock fee');
const day10 = Date.parse(mandate.day10ReminderAt);
const day12 = Date.parse(mandate.day12PreDebitNoticeAt);
const day14 = Date.parse(mandate.day14SettlementAt);
assert(!Number.isNaN(day10) && !Number.isNaN(day12) && !Number.isNaN(day14), 'day 10, 12, and 14 are real timestamps');
assert(day10 < day12 && day12 < day14, 'the trust clock runs day 10, then day 12, then day 14');
assert(day14 - day12 === 48 * 60 * 60 * 1000, 'the pre-debit notice is 48 hours before settlement');

const oneTap = buildCompliantUnlockCheckout('upl_test', 45000, 'ONE_TAP_UPI');
const pro = buildCompliantUnlockCheckout('upl_test', 45000, 'PRO_299');
assert(oneTap.amountPaise === 45000, 'one-tap UPI charges the unlock fee');
assert(pro.amountPaise === 29900, 'Pro checkout is ₹299');

assert(calculateMunshiCommission(45000) === 13500, '₹450 fee pays the munshi ₹135');
assert(calculateMunshiCommission(29900) === 8970, '₹299 subscription pays the munshi ₹89.70');
const refunded = processRejectedClaimRefund(
  { recoverableVariancePaise: 150000 },
  45000,
  450000,
  'SWIGGY-REJECT-19',
);
assert(refunded.refundPaise === 15000, 'rejected claim refunds the proportional ₹150');
assert(refunded.claimStatus === 'REJECTED_REFUNDED', 'finding is marked refunded');

const statement = {
  platform: 'SWIGGY',
  outletName: 'Sample outlet',
  payoutCycleStart: '2026-11-01',
  payoutCycleEnd: '2026-11-07',
  declaredSummaryNetPayoutPaise: 100000,
  orders: [{ declaredOrderPayoutPaise: 120000 }],
  outletAdjustments: [
    { kind: 'ADDITION', settledThisCyclePaise: 5000 },
    { kind: 'DEDUCTION', settledThisCyclePaise: 25000 },
  ],
  heldOrders: [{ orderId: 'HELD-1', amountPaise: 42000, reason: 'Unresolved customer complaint' }],
};
const taxPackage = {
  gstr2bInputTaxCredit18PctPaise: 1800,
  form26asTds194OPaise: 100,
  gstr8TcsSec52Paise: 50,
  section95PassThroughGstPaise: 500,
  tallyJournalCsv: 'Voucher Type,Ledger,Debit,Credit\nJournal,Sales,0.00,100.00',
};
const pack = buildEvidencePackWorkbook(statement, { findings: largeFindings, totalRecoverablePaise: 450000 }, taxPackage);
const parsed = XLSX.read(pack.bytes, { type: 'array' });
assert(
  EVIDENCE_PACK_SHEETS.every((name) => parsed.SheetNames.includes(name)),
  `workbook has the 4 tabs, got ${parsed.SheetNames.join(' | ')}`,
);
for (const name of EVIDENCE_PACK_SHEETS) {
  const rows = XLSX.utils.sheet_to_json(parsed.Sheets[name], { header: 1 });
  assert(rows.length > 1 && rows.some((row) => row.some((cell) => String(cell ?? '').trim())), `${name} has rows`);
}

resetAuditMemory();
const uploadResponse = await uploadAudit({
  request: new Request('http://localhost/api/audit/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      statement: {
        platform: 'SWIGGY',
        vertical: 'RESTAURANT',
        payoutCycleStart: '2026-11-01',
        payoutCycleEnd: '2026-11-07',
        declaredSummaryNetPayoutPaise: 0,
        orders: [],
        outletAdjustments: [],
        heldOrders: [],
      },
    }),
  }),
  env: {},
});
const uploadPayload = await uploadResponse.json();
assert(uploadResponse.status === 200 && uploadPayload.success === true && uploadPayload.storage === 'memory', 'upload API stores in memory without a database');

if (failed) {
  console.error(`${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('phase 5 audit API checks passed');
