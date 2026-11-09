import { PDFDocument } from '@cantoo/pdf-lib';
import { applyBps } from '../functions/_lib/currency.mjs';
import {
  chunkPdfMax10Pages,
  hasCorruptedLegacyIndicFont,
  slicePdfMax2Pages,
} from '../functions/_lib/pdfRouter.mjs';
import { mapUnfamiliarSpreadsheetHeaders } from '../functions/_lib/headerMapper.mjs';
import {
  inspectAndQueueOcrDiscrepancies,
  resolveCellVerification,
} from '../functions/_lib/selfHealingCrop.mjs';

let failed = 0;

function assert(condition, label) {
  if (!condition) {
    failed += 1;
    console.error(`FAIL ${label}`);
    return;
  }
  console.log(`ok ${label}`);
}

async function blankPdf(pageCount) {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) pdf.addPage();
  return pdf.save();
}

const source = await blankPdf(25);
const chunks = await chunkPdfMax10Pages(source);
const counts = [];
for (const chunk of chunks) {
  const document = await PDFDocument.load(chunk);
  counts.push(document.getPageCount());
}
assert(chunks.length === 3 && counts.join(',') === '10,10,5', `25-page PDF chunks to [10, 10, 5], got ${counts.join(',')}`);

const sliced = await slicePdfMax2Pages(source, 0);
const sliceDoc = await PDFDocument.load(sliced);
assert(sliceDoc.getPageCount() === 2, 'slicePdfMax2Pages returns 2 pages');

assert(
  hasCorruptedLegacyIndicFont("dk;kZy; vkns'k ;g gS fd {ks=h; Hkqxrku") === true,
  'KrutiDev gibberish is flagged',
);
assert(hasCorruptedLegacyIndicFont('The office order payment is settled') === false, 'clean English is not flagged');
assert(
  hasCorruptedLegacyIndicFont('कार्यालय आदेश यह है कि क्षेत्रीय भुगतान') === false,
  'Unicode Hindi is not flagged',
);

const headers = ['Cust Payable (Rs)', 'Merch Settlement', 'Order ID'];
const samples = [['420.00', '352.08', 'SW-1']];
const firstMap = await mapUnfamiliarSpreadsheetHeaders(headers, samples);
const secondMap = await mapUnfamiliarSpreadsheetHeaders(headers, samples);
assert(firstMap.cacheHit === false, 'first header map is a cache miss');
assert(secondMap.cacheHit === true, 'second header map is a cache hit');
assert(
  firstMap.mapping['Cust Payable (Rs)'] === 'netOrderValuePaise' &&
    firstMap.mapping['Merch Settlement'] === 'declaredOrderPayoutPaise' &&
    JSON.stringify(firstMap.mapping) === JSON.stringify(secondMap.mapping),
  'cached header mapping matches the canonical fields',
);

function misreadOrder() {
  const serviceFeePaise = 5417;
  const correctTax = applyBps(serviceFeePaise, 1800);
  const netOrderValuePaise = 50000;
  return {
    orderId: 'SW-OCR-1',
    orderStatus: 'DELIVERED',
    itemSubtotalPaise: netOrderValuePaise,
    packagingChargePaise: 0,
    restaurantDiscountSharePaise: 0,
    swiggyOneOrGoldDiscountPaise: 0,
    netOrderValuePaise,
    serviceFeePaise,
    paymentMechanismFeePaise: 0,
    longDistanceFeePaise: 0,
    pocketHeroFeePaise: 0,
    taxesOnFees18PctPaise: 97500,
    gstSection95Paise: 0,
    tds194OPaise: 0,
    tcsPaise: 0,
    customerCompensationPaise: 0,
    cancellationDeductionPaise: 0,
    deliveryChargeRecoveryPaise: 0,
    promoRecoveryPaise: 0,
    otherOrderDeductionPaise: 0,
    declaredOrderPayoutPaise: netOrderValuePaise - serviceFeePaise - correctTax,
    sourceTabName: 'Order Level',
    sourceRowNumber: 6,
    ocrConfidenceStatus: 'NEEDS_CLOUD',
  };
}

function statementFor(order) {
  return {
    platform: 'SWIGGY',
    vertical: 'RESTAURANT',
    payoutCycleStart: '2026-11-01',
    payoutCycleEnd: '2026-11-07',
    declaredSummaryNetPayoutPaise: order.declaredOrderPayoutPaise,
    orders: [order],
    outletAdjustments: [],
    heldOrders: [],
  };
}

const contract = { commissionBps: null, approvedDiscountShareBps: 0, approvedWeeklyAdCapPaise: 100000000 };
assert(applyBps(5417, 1800) === 975, '18% of the fee is 975 paise');

const adminScan = inspectAndQueueOcrDiscrepancies(statementFor(misreadOrder()), {}, { munshiId: null });
assert(adminScan.queue.length === 1, 'OCR misread is queued');
assert(adminScan.queue[0].columnName === 'taxesOnFees18PctPaise', 'the tax cell is the suspect field');
assert(adminScan.queue[0].extractedPaise === 97500 && adminScan.queue[0].expectedPaise === 975, 'expected 975 paise versus extracted 97500');
assert(adminScan.queue[0].assignedToRole === 'ADMIN', 'no munshi assigns the cell to ADMIN');
assert(adminScan.statement.orders[0].ocrConfidenceStatus === 'NEEDS_VERIFICATION', 'row is marked NEEDS_VERIFICATION');

const munshiScan = inspectAndQueueOcrDiscrepancies(statementFor(misreadOrder()), {}, { munshiId: 'munshi-1' });
assert(munshiScan.queue[0].assignedToRole === 'MUNSHI', 'a munshi id assigns the cell to MUNSHI');

const healed = resolveCellVerification(adminScan.statement, adminScan.queue[0], '9.75', contract, {});
const horizontalErrors = (healed.auditResult?.findings || []).filter(
  (finding) => finding.findingType === 'ORDER_ROW_ARITHMETIC_MISMATCH',
);
assert(healed.statement.orders[0].ocrConfidenceStatus === 'VERIFIED', 'healed row is VERIFIED');
assert(healed.queueItem.status === 'RESOLVED', 'queue item is RESOLVED');
assert(healed.horizontalGapPaise === 0 && horizontalErrors.length === 0, 'horizontal math has 0 errors after ₹9.75');
assert(healed.statement.orders[0].taxesOnFees18PctPaise === 975, 'the tax cell is 975 paise');

if (failed) {
  console.error(`${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('phase 4 OCR pipeline checks passed');
