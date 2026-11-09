import { applyBps } from '../functions/_lib/currency.mjs';
import { runRestaurantAudit } from '../functions/_lib/restaurantAuditor.mjs';
import { runEcommerceAudit } from '../functions/_lib/ecommerceAuditor.mjs';
import { generateClaimTicket } from '../functions/_lib/claimGenerator.mjs';
import { buildTaxAutopilotPackage } from '../functions/_lib/taxAutopilot.mjs';

let failed = 0;

function assert(condition, label) {
  if (!condition) {
    failed += 1;
    console.error(`FAIL ${label}`);
    return;
  }
  console.log(`ok ${label}`);
}

function order(partial) {
  return {
    orderStatus: 'DELIVERED',
    packagingChargePaise: 0,
    restaurantDiscountSharePaise: 0,
    swiggyOneOrGoldDiscountPaise: 0,
    paymentMechanismFeePaise: 0,
    longDistanceFeePaise: 0,
    pocketHeroFeePaise: 0,
    customerCompensationPaise: 0,
    cancellationDeductionPaise: 0,
    deliveryChargeRecoveryPaise: 0,
    promoRecoveryPaise: 0,
    otherOrderDeductionPaise: 0,
    tcsPaise: 0,
    sourceTabName: 'Order Level',
    sourceRowNumber: 2,
    ...partial,
  };
}

function restaurantPayout(row) {
  return (
    row.netOrderValuePaise -
    row.serviceFeePaise -
    row.paymentMechanismFeePaise -
    row.longDistanceFeePaise -
    row.pocketHeroFeePaise -
    row.taxesOnFees18PctPaise -
    row.gstSection95Paise -
    row.tds194OPaise -
    row.tcsPaise -
    row.customerCompensationPaise -
    row.cancellationDeductionPaise -
    row.deliveryChargeRecoveryPaise -
    row.promoRecoveryPaise -
    row.otherOrderDeductionPaise
  );
}

const zomatoItem = 31500;
const zomatoFee = applyBps(zomatoItem, 2700);
const zomatoTax = applyBps(zomatoFee, 1800);
const zomatoGst95 = applyBps(zomatoItem, 500);
const zomatoTds = applyBps(zomatoItem, 10);
const zomato = order({
  orderId: 'ZOM-315',
  itemSubtotalPaise: zomatoItem,
  netOrderValuePaise: zomatoItem,
  serviceFeePaise: zomatoFee,
  taxesOnFees18PctPaise: zomatoTax,
  gstSection95Paise: zomatoGst95,
  tds194OPaise: zomatoTds,
});
zomato.declaredOrderPayoutPaise = restaurantPayout(zomato);

const zomatoAudit = runRestaurantAudit(
  {
    platform: 'ZOMATO',
    payoutCycleStart: '2026-11-01',
    payoutCycleEnd: '2026-11-07',
    declaredSummaryNetPayoutPaise: zomato.declaredOrderPayoutPaise,
    orders: [zomato],
    outletAdjustments: [],
    heldOrders: [],
  },
  { commissionBps: 2700, approvedDiscountShareBps: 0, approvedWeeklyAdCapPaise: 0 },
  { posOrderIds: ['ZOM-315'] },
);
assert(
  zomatoAudit.findings.every((finding) => finding.recoverableVariancePaise === 0),
  'clean zomato has no recoverable finding',
);
assert(zomatoAudit.statutoryTaxSummary.gstSection95Paise === zomatoGst95, 'section 9(5) is statutory');
assert(zomatoAudit.statutoryTaxSummary.tds194OPaise === zomatoTds, 'tds 194-O is statutory');
assert(
  !zomatoAudit.findings.some((finding) => /SECTION_95|TDS_194/.test(String(finding.findingType))),
  'statutory tax is not an overcharge',
);

const swiggyItem = 4200;
const swiggyFee = applyBps(swiggyItem, 2000);
const swiggyTax = applyBps(swiggyFee, 1800);
const swiggy = order({
  orderId: 'SW-42',
  itemSubtotalPaise: swiggyItem,
  netOrderValuePaise: swiggyItem,
  serviceFeePaise: swiggyFee,
  taxesOnFees18PctPaise: swiggyTax,
  gstSection95Paise: 0,
  tds194OPaise: 0,
});
swiggy.declaredOrderPayoutPaise = restaurantPayout(swiggy);
const swiggyAudit = runRestaurantAudit(
  {
    platform: 'SWIGGY',
    payoutCycleStart: '2026-11-01',
    payoutCycleEnd: '2026-11-07',
    declaredSummaryNetPayoutPaise: swiggy.declaredOrderPayoutPaise,
    orders: [swiggy],
    outletAdjustments: [],
    heldOrders: [],
  },
  { commissionBps: 2000, approvedDiscountShareBps: 0 },
  { posOrderIds: ['SW-42'] },
);
assert(
  swiggyAudit.findings.every((finding) => finding.recoverableVariancePaise === 0),
  'clean swiggy has no recoverable finding',
);

const base = 100000;
const billedFee = applyBps(base, 2600);
const fairFee = applyBps(base, 2000);
const billedTax = applyBps(billedFee, 1800);
const over = order({
  orderId: 'ZOM-1000',
  itemSubtotalPaise: base,
  netOrderValuePaise: base,
  serviceFeePaise: billedFee,
  taxesOnFees18PctPaise: billedTax,
  gstSection95Paise: 0,
  tds194OPaise: 0,
  sourceRowNumber: 8,
});
over.declaredOrderPayoutPaise = restaurantPayout(over);
const overAudit = runRestaurantAudit(
  {
    platform: 'ZOMATO',
    payoutCycleStart: '2026-11-01',
    payoutCycleEnd: '2026-11-07',
    declaredSummaryNetPayoutPaise: over.declaredOrderPayoutPaise,
    orders: [over],
    outletAdjustments: [],
    heldOrders: [],
  },
  { commissionBps: 2000, approvedDiscountShareBps: 0 },
  { posOrderIds: ['ZOM-1000'] },
);
const commissionFinding = overAudit.findings.find((finding) => finding.findingType === 'COMMISSION_RATE_OVERCHARGE');
assert(commissionFinding, 'commission overcharge is found');
assert(billedFee - fairFee === 6000, 'excess commission is 6000 paise');
assert(commissionFinding?.recoverableVariancePaise === 7080, 'variance includes 18 percent GST');
assert(!overAudit.findings.some((finding) => finding.findingType === 'EXCESS_GST_ON_FEES'), 'check 3 does not double count');

const bridgeOrder = order({
  orderId: 'SW-BRIDGE',
  itemSubtotalPaise: 10000,
  netOrderValuePaise: 10000,
  serviceFeePaise: 0,
  taxesOnFees18PctPaise: 0,
  gstSection95Paise: 0,
  tds194OPaise: 0,
  declaredOrderPayoutPaise: 10000,
});
const bridge = runRestaurantAudit(
  {
    platform: 'SWIGGY',
    payoutCycleStart: '2026-11-01',
    payoutCycleEnd: '2026-11-07',
    declaredSummaryNetPayoutPaise: 11500,
    orders: [bridgeOrder],
    outletAdjustments: [
      {
        kind: 'ADDITION',
        category: 'OTHER',
        settledThisCyclePaise: 2000,
        outstandingCarryForwardPaise: 9999,
        sourceTabName: 'Addition Deductions Details',
        sourceRowNumber: 4,
        invoiceNumber: 'ADD-1',
      },
      {
        kind: 'DEDUCTION',
        category: 'OTHER',
        settledThisCyclePaise: 500,
        outstandingCarryForwardPaise: 0,
        sourceTabName: 'Addition Deductions Details',
        sourceRowNumber: 9,
      },
    ],
    heldOrders: [],
  },
  { commissionBps: 0, approvedDiscountShareBps: 0, approvedWeeklyAdCapPaise: 100000 },
  { posOrderIds: ['SW-BRIDGE'] },
);
assert(bridge.reconciledNetPayoutPaise === 11500, 'settled bridge ignores outstanding');
assert(
  !bridge.findings.some((finding) => finding.findingType === 'SUMMARY_BRIDGE_UNEXPLAINED_GAP'),
  'matching UTR bridge is quiet',
);
assert(bridge.newCarryForwardEntries[0]?.outstandingPaise === 9999, 'outstanding is carried forward');

const held = runRestaurantAudit(
  {
    platform: 'SWIGGY',
    payoutCycleStart: '2026-11-01',
    payoutCycleEnd: '2026-11-07',
    declaredSummaryNetPayoutPaise: 0,
    orders: [],
    outletAdjustments: [],
    heldOrders: [{ orderId: 'HELD-1', amountPaise: 4200, sourceTabName: 'Unresolved customer complaints', sourceRowNumber: 3 }],
  },
  { commissionBps: 2000, approvedDiscountShareBps: 0 },
  { posOrderIds: ['HELD-1', 'MISSING-9'], priorPendingLedger: [{ orderId: 'HELD-1', amountPaise: 4200 }] },
);
assert(
  held.findings.some((finding) => finding.findingType === 'HELD_ORDER_ACTION_REQUIRED' && finding.orderId === 'HELD-1'),
  'held complaint stays an action item',
);
assert(
  held.findings.some((finding) => finding.findingType === 'DELIVERED_ORDER_MISSING_FROM_PAYOUT' && finding.orderId === 'MISSING-9'),
  'missing POS order is detected',
);
assert(
  held.findings.some((finding) => finding.findingType === 'OVERDUE_HELD_ORDER_DISPUTE'),
  'prior held order is overdue',
);

function sale(partial) {
  const row = {
    transactionType: 'SALE',
    orderStatus: 'DELIVERED',
    declaredWeightGrams: 450,
    billedWeightGrams: 450,
    fixedOrClosingFeePaise: 0,
    collectionFeePaise: 0,
    reverseShippingFeePaise: 0,
    tcsSec52Paise: 0,
    tds194OPaise: 0,
    spfOrReimbursementPaise: 0,
    otherDeductionPaise: 0,
    sourceTabName: 'Orders',
    ...partial,
  };
  const gst = applyBps(row.marketplaceCommissionPaise, 1800);
  row.gstOnFees18PctPaise = gst;
  row.declaredSettledPaise =
    row.grossSalePaise -
    row.marketplaceCommissionPaise -
    gst -
    row.forwardShippingFeePaise;
  return row;
}

const normalShip = 2000;
const heavyShip = normalShip + 30820;
const heavy = sale({
  orderId: 'FK-2000',
  orderItemId: 'FK-ITEM-2000',
  sku: 'SAREE',
  grossSalePaise: 200000,
  marketplaceCommissionPaise: applyBps(200000, 1000),
  billedWeightGrams: 1000,
  forwardShippingFeePaise: heavyShip,
  sourceRowNumber: 6,
});
const siblings = [2, 3, 4, 5].map((rowNumber) =>
  sale({
    orderId: `FK-SIBLING-${rowNumber}`,
    orderItemId: `FK-ITEM-${rowNumber}`,
    sku: 'SAREE',
    grossSalePaise: 50000,
    marketplaceCommissionPaise: applyBps(50000, 1000),
    billedWeightGrams: 450,
    forwardShippingFeePaise: normalShip,
    sourceRowNumber: rowNumber,
  }),
);
const flipkartItems = [...siblings, heavy];
const flipkartSettled = flipkartItems.reduce((sum, item) => sum + item.declaredSettledPaise, 0);
const flipkartAudit = runEcommerceAudit(
  {
    platform: 'FLIPKART',
    payoutCycleStart: '2026-11-01',
    payoutCycleEnd: '2026-11-07',
    declaredSummaryNetPayoutPaise: flipkartSettled,
    items: flipkartItems,
    outletAdjustments: [],
  },
  { categoryCommissionBps: 1000, skuWeightMapGrams: { SAREE: 450 } },
);
const weightFindings = flipkartAudit.findings.filter(
  (finding) => finding.findingType === 'SKU_WEIGHT_OR_SHIPPING_OVERCHARGE',
);
const weightVariance = weightFindings.reduce((sum, finding) => sum + finding.recoverableVariancePaise, 0);
assert(weightFindings.length === 1, 'one weight-slab jump in five rows');
assert(weightFindings[0]?.billedWeightGrams === 1000, 'the jump is the 1000g row');
assert(weightVariance === 30820, 'flipkart recoverable is 30820 paise');
assert(heavy.grossSalePaise === 200000, 'saree gross is 200000 paise');

const ticket = generateClaimTicket(weightFindings[0], {
  platform: 'FLIPKART',
  payoutCycleStart: '2026-11-01',
  payoutCycleEnd: '2026-11-07',
});
assert(ticket.claimTicketEn.includes('FK-2000') && ticket.claimTicketEn.includes('Orders'), 'english ticket quotes the row');
assert(ticket.claimTicketHi.includes('FK-2000') && ticket.claimTicketHi.includes('वापस'), 'hindi ticket quotes the row');

const tax = buildTaxAutopilotPackage(
  {
    platform: 'ZOMATO',
    orders: [zomato],
    items: [],
  },
  zomatoAudit,
);
assert(tax.tallyJournalCsv.includes('TDS 194-O receivable'), 'tally csv has 26AS line');
assert(tax.tallyVoucherXml.includes('<VOUCHER'), 'tally xml is present');
assert(tax.gstr2bInputTaxCredit18PctPaise === zomatoTax, 'gstr-2b itc matches fee GST');
assert(tax.form26asTds194OPaise === zomatoTds, 'form 26AS matches 194-O');
assert(tax.section95PassThroughGstPaise === zomatoGst95, 'section 9(5) is separated');

if (failed > 0) {
  console.error(`${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('phase 2 auditor checks passed');
