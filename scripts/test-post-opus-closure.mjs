/**
 * Post-Opus operational closure: OCR PII, 2,000-row speed, munshi UPI, trust clock, Pro ₹299.
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as XLSX from 'xlsx';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (rel) => import(pathToFileURL(join(root, rel)).href);

const { scrubOcrOutputPii } = await load('functions/_lib/cloudOcrArbitrage.mjs');
const { applyBps } = await load('functions/_lib/currency.mjs');
const { applyFreemiumTeaserMask } = await load('functions/_lib/unlockEngine.mjs');
const { auditUploadedWorkbook } = await load('functions/_lib/adapters/registry.mjs');
const {
  completePro299Checkout,
  createAuditUpload,
  createUnlockCheckout,
  processTrustClock,
  requestMunshiWithdrawal,
  resetAuditMemory,
} = await load('functions/_lib/auditRepository.mjs');

const scrubbed = scrubOcrOutputPii({
  rows: [
    ['Order ID', 'Customer Name', 'Address', 'Net'],
    ['SW-1001', 'Asha Devi', '12 Market Road', '₹197.58'],
  ],
  text: 'Order SW-1001 UTR HDFCNEFT4500 GSTIN 27AAAAA0000A1Z5 call 9876543210 amount ₹197.58 asha@example.com',
});
const header = scrubbed.rows[0].join('|');
assert.equal(header.includes('Customer Name'), false, 'customer name column is stripped');
assert.equal(header.includes('Address'), false, 'address column is stripped');
assert.equal(header.includes('Order ID'), true, 'order id column stays');
assert.equal(JSON.stringify(scrubbed.rows).includes('Asha Devi'), false, 'customer name cell is gone');
assert.equal(JSON.stringify(scrubbed.rows).includes('12 Market Road'), false, 'address cell is gone');
assert.equal(JSON.stringify(scrubbed.rows).includes('₹197.58'), true, 'rupee amount stays in the row');
assert.equal(scrubbed.text.includes('[REDACTED_PHONE]'), true, 'mobile is redacted');
assert.equal(scrubbed.text.includes('9876543210'), false, 'raw mobile is gone');
assert.equal(scrubbed.text.includes('[REDACTED_EMAIL]'), true, 'email is redacted');
assert.equal(scrubbed.text.includes('SW-1001'), true, 'order id stays in text');
assert.equal(scrubbed.text.includes('HDFCNEFT4500'), true, 'UTR stays');
assert.equal(scrubbed.text.includes('27AAAAA0000A1Z5'), true, 'GSTIN stays');
assert.equal(scrubbed.text.includes('₹197.58'), true, 'rupee amount stays in text');

const proFee = applyFreemiumTeaserMask({
  totalRecoverablePaise: 450000,
  findings: [
    { orderId: 'A', recoverableVariancePaise: 150000 },
    { orderId: 'B', recoverableVariancePaise: 150000 },
    { orderId: 'C', recoverableVariancePaise: 150000 },
  ],
}, { subscriptionTier: 'PRO_299', isPro: true });
assert.equal(proFee.isUnlocked, false, 'PRO_299 above ₹200 stays masked');
assert.equal(proFee.unlockFeePaise, applyBps(450000, 500), 'PRO_299 unlock fee is 5%');

resetAuditMemory();
const synced = await completePro299Checkout({}, {
  tenantId: 'tenant_pro',
  munshiId: 'munshi_pro',
  amountPaise: 29900,
  orderId: 'order_pro_299',
});
assert.equal(synced.subscriptionTier, 'PRO_299', 'tenant tier is PRO_299');
assert.equal(synced.commissionPaise, 8970, 'munshi receives ₹89.70');
const withdrawal = await requestMunshiWithdrawal({}, {
  munshiCode: 'munshi_pro',
  upiId: 'shop@upi',
  amountPaise: 8970,
});
assert.equal(withdrawal.status, 'REQUESTED', 'UPI withdrawal is requested');
assert.equal(withdrawal.upi_id, 'shop@upi', 'UPI id is stored');

const upload = await createAuditUpload({}, {
  tenantId: 'tenant_clock',
  munshiId: 'munshi_clock',
  statement: {
    platform: 'SWIGGY',
    vertical: 'RESTAURANT',
    payoutCycleStart: '2026-01-01',
    payoutCycleEnd: '2026-01-07',
    declaredSummaryNetPayoutPaise: 10000,
    orders: [{
      orderId: 'SW-CLOCK',
      orderStatus: 'DELIVERED',
      itemSubtotalPaise: 10000,
      netOrderValuePaise: 10000,
      declaredOrderPayoutPaise: 10000,
      sourceTabName: 'Order Level',
      sourceRowNumber: 2,
    }],
    outletAdjustments: [],
    heldOrders: [],
  },
});
await createUnlockCheckout({}, upload.uploadId, 'TRUST_CLOCK_MANDATE', { now: '2026-01-01T00:00:00.000Z' });
const clock = await processTrustClock({}, { now: '2026-02-01T00:00:00.000Z' });
assert.equal(clock.processed, 1, 'expired mandate is processed');
assert.equal(clock.uploads[0].mandateStatus, 'DUE_FOR_COLLECTION', 'mandate is due for collection');
assert.equal(clock.uploads[0].uploadId, upload.uploadId, 'the clock names the upload');

function sheet(rows) {
  const book = XLSX.utils.book_new();
  const orderSheet = XLSX.utils.aoa_to_sheet(rows.orders);
  orderSheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows.summary), 'Summary');
  XLSX.utils.book_append_sheet(book, orderSheet, 'Order Level');
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows.charges), 'Other charges and deductions');
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Order ID', 'Amount', 'Reason']]), 'Unresolved customer complaints');
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Restaurant Share (%)', 100]]), 'Discount summary');
  assert.ok(book.Sheets['Order Level']['!merges']?.length, 'workbook contains a merged title cell');
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
}

const orderRows = [
  ['Swiggy payout annexure', '', '', '', ''],
  ['', '', '', '', ''],
  ['Order ID', 'Item Total', 'Order Payout', 'Customer Name', 'Customer Phone'],
];
for (let index = 1; index <= 2000; index += 1) {
  if (index % 100 === 0) orderRows.push(['', '', '', '', '']);
  orderRows.push([`SW-${index}`, 100, 100, 'Asha Devi', '9876543210']);
}
orderRows.push(['', 'GRAND TOTAL', 200000, '', '']);
const bytes = sheet({
  summary: [
    ['Payout cycle start', '2026-11-01'],
    ['Payout cycle end', '2026-11-07'],
    ['Bank UTR', 'UTR-SW-2000'],
  ],
  orders: orderRows,
  charges: [
    ['Adjusment Type', 'Total', 'Settled', 'Outstanding'],
  ],
});

const started = performance.now();
const audited = await auditUploadedWorkbook(bytes, 'swiggy-2000.xlsx', { commissionBps: null });
const elapsedMs = Math.round(performance.now() - started);
console.log(`2000-row swiggy audit ms ${elapsedMs}`);
assert.equal(audited.statement.orders.length, 2000, 'all 2000 order rows are audited');
assert.equal(JSON.stringify(audited.statement.orders).includes('9876543210'), false, 'benchmark phone column is scrubbed');
assert.equal(JSON.stringify(audited.statement.orders).includes('Asha Devi'), false, 'benchmark name column is scrubbed');
assert.ok(elapsedMs < 500, `2000-row audit finished in ${elapsedMs} ms`);

console.log('post-opus closure checks passed');
