import * as XLSX from 'xlsx';
import { auditUploadedWorkbook } from '../functions/_lib/adapters/registry.mjs';
import { hasCorruptedLegacyIndicFont } from '../functions/_lib/adapters/baseAdapter.mjs';
import { toMinorUnits } from '../functions/_lib/currency.mjs';

let failed = 0;

function assert(condition, label) {
  if (!condition) {
    failed += 1;
    console.error(`FAIL ${label}`);
    return;
  }
  console.log(`ok ${label}`);
}

function workbookBytes(sheets) {
  const book = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
}

const swiggyBytes = workbookBytes({
  Summary: [
    ['Payout cycle start', '2026-11-01'],
    ['Payout cycle end', '2026-11-07'],
    ['Bank UTR', 'UTR-SW-1'],
  ],
  'Order Level': [
    ['Outlet', 'Demo Kitchen'],
    ['City', 'Delhi'],
    ['Period', 'November'],
    ['Note', 'Annexure'],
    ['Order ID', 'Item Total', 'Order Payout', 'Customer Name', 'Customer Phone'],
    ['SW-1', 100, 100, 'Asha Devi', '9999900000'],
    ['', 'GRAND TOTAL', 100, '', ''],
  ],
  'Unresolved customer complaints': [
    ['Order ID', 'Amount', 'Reason'],
    ['HELD-1', 42, 'Missing item'],
  ],
  'Other charges and deductions': [
    ['Current week'],
    ['Adjustment Type', 'Total', 'Settled', 'Outstanding'],
    ['Prior week'],
    ['Adjusment Type', 'Total', 'Settled', 'Outstanding'],
    ['Penalty', 500, 300, 200],
  ],
  'Discount summary': [['Restaurant Share (%)', 100]],
});

const swiggy = await auditUploadedWorkbook(swiggyBytes, 'swiggy-week.xlsx', { commissionBps: 0 });
assert(swiggy.statement.orders.length === 1, 'swiggy ignores the grand total row');
assert(swiggy.statement.orders[0].sourceRowNumber === 6, 'swiggy keeps the excel row number');
assert(!JSON.stringify(swiggy.statement.orders).includes('9999900000'), 'customer phone is scrubbed');
assert(!JSON.stringify(swiggy.statement.orders).includes('Asha Devi'), 'customer name is scrubbed');
assert(swiggy.statement.heldOrders.length === 1, 'swiggy held order is parsed');
const penalty = swiggy.statement.outletAdjustments.find((row) => row.invoiceNumber === 'Penalty');
assert(penalty?.settledThisCyclePaise === toMinorUnits(300), 'only settled 300 enters the ledger');
assert(penalty?.outstandingCarryForwardPaise === toMinorUnits(200), 'outstanding 200 is carry-forward');
assert(
  swiggy.auditResult.reconciledNetPayoutPaise ===
    swiggy.statement.orders[0].declaredOrderPayoutPaise - toMinorUnits(300),
  'utr bridge uses settled 300 and not the total 500',
);
assert(
  !swiggy.auditResult.findings.some((finding) => finding.findingType === 'SUMMARY_BRIDGE_UNEXPLAINED_GAP'),
  'swiggy bridge matches',
);

const zomatoBytes = workbookBytes({
  Summary: [
    ['Payout cycle start', '2026-11-01'],
    ['Payout cycle end', '2026-11-07'],
  ],
  'Order Level': [
    ['Order ID', 'Subtotal (items total)', 'Net order value', 'Service fee', 'Order level Payout', 'Bank UTR'],
    ['ZOM-1', 200, 200, 0, 200, 'UTR-ZOM-1'],
  ],
  'Addition Deductions Details': [
    ['Addition Type'],
    ['Particulars', 'Settled', 'Outstanding'],
    ['TDS 194H Refund', 250, 0],
    ['Deduction Type'],
    ['Particulars', 'Settled', 'Outstanding'],
    ['Zomato Ads', 1000, 0],
    ['Hyperpure', 500, 0],
  ],
});

const zomato = await auditUploadedWorkbook(zomatoBytes, 'zomato-week.xlsx', {
  commissionBps: 0,
  approvedWeeklyAdCapPaise: 100000000,
});
const zomatoOrder = zomato.statement.orders[0].declaredOrderPayoutPaise;
assert(
  zomato.auditResult.reconciledNetPayoutPaise === zomatoOrder + toMinorUnits(250) - toMinorUnits(1500),
  'zomato bridge is orders plus 250 minus 1500',
);

const heavySettled = toMinorUnits('1671.80');
const normalSettled = toMinorUnits(480);
const ads = toMinorUnits(10);
const spf = toMinorUnits(25);
const flipkartNet = heavySettled + normalSettled * 4 - ads + spf;
const flipkartNetText = `${Math.floor(flipkartNet / 100)}.${String(flipkartNet % 100).padStart(2, '0')}`;
const flipkartRows = [
  ['Order ID', 'Order item ID', 'SKU', 'Order Status', 'Transaction Type', 'Sale Value', 'Commission', 'Forward Shipping', 'Billed Weight', 'Settled Amount'],
];
for (let index = 1; index <= 4; index += 1) {
  flipkartRows.push(['FK-NORMAL', `ITEM-${index}`, 'SAREE', 'Delivered', 'SALE', 500, 0, 20, 450, 480]);
}
flipkartRows.push(['FK-2000', 'ITEM-2000', 'SAREE', 'Delivered', 'SALE', 2000, 0, '328.20', 1000, '1671.80']);

const flipkartBytes = workbookBytes({
  Orders: flipkartRows,
  Ads: [
    ['Campaign', 'Settled'],
    ['PLA', 10],
  ],
  SPF: [
    ['Claim', 'Settled'],
    ['Damage', 25],
  ],
  Summary: [
    ['Net Payout', flipkartNetText],
    ['NEFT ID', 'NEFT-FK-1'],
  ],
});

const flipkart = await auditUploadedWorkbook(flipkartBytes, 'flipkart-stl.xlsx', {
  categoryCommissionBps: 0,
  skuWeightMapGrams: { SAREE: 450 },
});
const weight = flipkart.auditResult.findings.filter(
  (finding) => finding.findingType === 'SKU_WEIGHT_OR_SHIPPING_OVERCHARGE',
);
assert(weight.length === 1 && weight[0].recoverableVariancePaise === 30820, 'flipkart weight jump is 30820 paise');
assert(
  !flipkart.auditResult.findings.some((finding) => finding.findingType === 'NEFT_BRIDGE_MISMATCH'),
  'flipkart neft bridge matches orders ads and spf',
);
assert(flipkart.auditResult.reconciledNetPayoutPaise === flipkartNet, 'flipkart neft total is exact');

const dummy = workbookBytes({
  Notes: [
    ['Hello'],
    ['Picnic list'],
  ],
});
const started = performance.now();
let rejected = false;
try {
  await auditUploadedWorkbook(dummy, 'notes.xlsx');
} catch (err) {
  rejected = err?.code === 'BOUNCER';
}
assert(rejected, 'dummy workbook is rejected');
assert(performance.now() - started < 50, 'bouncer rejects in under 50ms');
assert(hasCorruptedLegacyIndicFont('dk;kZy; dk;kZy; dk;kZy; dk;kZy;'), 'legacy indic gibberish is detected');

if (failed > 0) {
  console.error(`${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('phase 3 adapter checks passed');
