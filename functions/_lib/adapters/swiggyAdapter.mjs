import {
  findHeaderRowIndex,
  findSheetName,
  isSummaryOrTotalRow,
  moneyPaise,
  rowObject,
  sheetToAoa,
} from './baseAdapter.mjs';

const ORDER_ALIASES = {
  orderId: ['order id', 'order no'],
  itemSubtotalPaise: ['item total', 'item subtotal', 'subtotal'],
  packagingChargePaise: ['packaging charge', 'packaging'],
  restaurantDiscountSharePaise: ['restaurant discount'],
  swiggyOneOrGoldDiscountPaise: ['swiggy one discount', 'gold discount'],
  netOrderValuePaise: ['net order value'],
  serviceFeePaise: ['service fee', 'commission'],
  paymentMechanismFeePaise: ['payment mechanism fee'],
  longDistanceFeePaise: ['long distance fee'],
  pocketHeroFeePaise: ['pocket hero fee'],
  taxesOnFees18PctPaise: ['gst on service fee', 'taxes on service fee', 'gst on fees'],
  gstSection95Paise: ['gst collected from customers', 'customer gst'],
  tds194OPaise: ['tds 194o', 'tds 194 o'],
  tcsPaise: ['tcs'],
  customerCompensationPaise: ['customer compensation'],
  cancellationDeductionPaise: ['cancellation deduction', 'cancellation'],
  deliveryChargeRecoveryPaise: ['delivery charge recovery'],
  promoRecoveryPaise: ['promo recovery'],
  otherOrderDeductionPaise: ['other deduction'],
  declaredOrderPayoutPaise: ['order level payout', 'order payout', 'net payout'],
};

/**
 * @param {import('xlsx').WorkBook} workbook
 */
export function isSwiggyWorkbook(workbook) {
  const names = workbook.SheetNames.join(' ').toLowerCase();
  const markers = ['summary', 'payout breakup', 'order level', 'unresolved customer complaints', 'other charges and deductions', 'discount summary'];
  const hits = markers.filter((marker) => names.includes(marker)).length;
  return names.includes('swiggy') || (names.includes('order level') && hits >= 2 && !names.includes('addition deduction'));
}

/**
 * @param {import('xlsx').WorkBook} workbook
 */
export function parseSwiggyWorkbook(workbook) {
  const summaryName = findSheetName(workbook, /summary|payout breakup/);
  const summary = readSummary(sheetToAoa(workbook, summaryName));
  const orderSheet = findSheetName(workbook, /^order level$/);
  const orders = parseOrders(sheetToAoa(workbook, orderSheet));
  const chargeSheet = findSheetName(workbook, /other charges and deductions/);
  const outletAdjustments = parseOtherCharges(sheetToAoa(workbook, chargeSheet));
  const heldSheet = findSheetName(workbook, /unresolved customer complaints/);
  const heldOrders = parseHeld(sheetToAoa(workbook, heldSheet));
  const discountSheet = findSheetName(workbook, /discount summary/);
  const share = readRestaurantShare(sheetToAoa(workbook, discountSheet));
  /** @type {string[]} */
  const warnings = [];
  if (discountSheet && share == null) warnings.push('Restaurant Share (%) is missing from Discount summary');

  const orderSum = orders.reduce((sum, row) => sum + row.declaredOrderPayoutPaise, 0);
  const adjustmentSum = outletAdjustments.reduce(
    (sum, row) => sum + (row.kind === 'ADDITION' ? row.settledThisCyclePaise : -row.settledThisCyclePaise),
    0,
  );

  return {
    platform: 'SWIGGY',
    vertical: 'RESTAURANT',
    currencyCode: 'INR',
    minorUnitScale: 100,
    payoutCycleStart: summary.payoutCycleStart,
    payoutCycleEnd: summary.payoutCycleEnd,
    bankUtr: summary.bankUtr,
    declaredSummaryNetPayoutPaise: summary.declaredSummaryNetPayoutPaise ?? orderSum + adjustmentSum,
    orders,
    items: [],
    outletAdjustments,
    heldOrders,
    warnings,
    restaurantSharePercent: share,
    piiColumnsDropped: ['Customer Name', 'Customer Phone', 'Phone', 'Mobile', 'Address'],
  };
}

/**
 * @param {unknown[][]} aoa
 */
function readSummary(aoa) {
  /** @type {Record<string, string>} */
  const found = {};
  for (const row of aoa) {
    const label = String(row?.[0] ?? '').toLowerCase();
    const value = row?.[1];
    if (label.includes('cycle start') || label.includes('period start')) found.start = String(value ?? '');
    if (label.includes('cycle end') || label.includes('period end') || label.includes('settlement date')) {
      found.end = found.end || String(value ?? '');
    }
    if (label.includes('net payout') || label.includes('summary net')) found.net = value;
    if (label.includes('utr') || label.includes('neft')) found.utr = String(value ?? '');
  }
  return {
    payoutCycleStart: found.start || '',
    payoutCycleEnd: found.end || '',
    bankUtr: found.utr || '',
    declaredSummaryNetPayoutPaise: found.net == null || found.net === '' ? null : moneyPaise(found.net),
  };
}

/**
 * @param {unknown[][]} aoa
 */
function parseOrders(aoa) {
  const header = findHeaderRowIndex(aoa, ORDER_ALIASES);
  if (!header) return [];
  /** @type {Array<Record<string, unknown>>} */
  const orders = [];
  for (let index = header.headerRowIndex + 1; index < aoa.length; index += 1) {
    const raw = rowObject(aoa, header.columns, index);
    if (isSummaryOrTotalRow(raw, ['orderId'])) continue;
    const item = moneyPaise(raw.itemSubtotalPaise);
    const packaging = moneyPaise(raw.packagingChargePaise);
    const restaurantDiscount = moneyPaise(raw.restaurantDiscountSharePaise);
    const swiggyDiscount = moneyPaise(raw.swiggyOneOrGoldDiscountPaise);
    const net = raw.netOrderValuePaise === '' || raw.netOrderValuePaise == null
      ? item + packaging - restaurantDiscount - swiggyDiscount
      : moneyPaise(raw.netOrderValuePaise);
    const serviceFee = moneyPaise(raw.serviceFeePaise);
    const paymentFee = moneyPaise(raw.paymentMechanismFeePaise);
    const longDistance = moneyPaise(raw.longDistanceFeePaise);
    const pocketHero = moneyPaise(raw.pocketHeroFeePaise);
    const tax = moneyPaise(raw.taxesOnFees18PctPaise);
    const gst95 = moneyPaise(raw.gstSection95Paise);
    const tds = moneyPaise(raw.tds194OPaise);
    const tcs = moneyPaise(raw.tcsPaise);
    const compensation = moneyPaise(raw.customerCompensationPaise);
    const cancellation = moneyPaise(raw.cancellationDeductionPaise);
    const delivery = moneyPaise(raw.deliveryChargeRecoveryPaise);
    const promo = moneyPaise(raw.promoRecoveryPaise);
    const other = moneyPaise(raw.otherOrderDeductionPaise);
    const computedPayout = net - serviceFee - paymentFee - longDistance - pocketHero - tax - gst95 - tds - tcs - compensation - cancellation - delivery - promo - other;
    const declared = raw.declaredOrderPayoutPaise === '' || raw.declaredOrderPayoutPaise == null
      ? computedPayout
      : moneyPaise(raw.declaredOrderPayoutPaise);
    orders.push({
      orderId: String(raw.orderId),
      orderStatus: 'DELIVERED',
      itemSubtotalPaise: item,
      packagingChargePaise: packaging,
      restaurantDiscountSharePaise: restaurantDiscount,
      swiggyOneOrGoldDiscountPaise: swiggyDiscount,
      netOrderValuePaise: net,
      serviceFeePaise: serviceFee,
      paymentMechanismFeePaise: paymentFee,
      longDistanceFeePaise: longDistance,
      pocketHeroFeePaise: pocketHero,
      taxesOnFees18PctPaise: tax,
      gstSection95Paise: gst95,
      tds194OPaise: tds,
      tcsPaise: tcs,
      customerCompensationPaise: compensation,
      cancellationDeductionPaise: cancellation,
      deliveryChargeRecoveryPaise: delivery,
      promoRecoveryPaise: promo,
      otherOrderDeductionPaise: other,
      declaredOrderPayoutPaise: declared,
      sourceTabName: 'Order Level',
      sourceRowNumber: index + 1,
      rawRowJson: JSON.stringify(raw),
    });
  }
  return orders;
}

/**
 * @param {unknown[][]} aoa
 */
function parseOtherCharges(aoa) {
  /** @type {Array<Record<string, unknown>>} */
  const adjustments = [];
  /** @type {Record<string, number> | null} */
  let columns = null;
  for (let index = 0; index < aoa.length; index += 1) {
    const cells = (aoa[index] || []).map((cell) => String(cell ?? '').toLowerCase().replace(/\s+/g, ' ').trim());
    if (cells.some((cell) => cell === 'adjustment type' || cell === 'adjusment type')) {
      columns = {
        type: cells.findIndex((cell) => cell === 'adjustment type' || cell === 'adjusment type'),
        total: cells.findIndex((cell) => cell === 'total'),
        settled: cells.findIndex((cell) => cell === 'settled'),
        outstanding: cells.findIndex((cell) => cell === 'outstanding'),
      };
      continue;
    }
    if (!columns || cells.every((cell) => !cell)) continue;
    const label = String(aoa[index]?.[columns.type] ?? '');
    if (isSummaryOrTotalRow({ orderId: label, label }, ['orderId'])) continue;
    const total = columns.total >= 0 ? moneyPaise(aoa[index][columns.total]) : 0;
    const settled = columns.settled >= 0 ? moneyPaise(aoa[index][columns.settled]) : 0;
    const outstanding = columns.outstanding >= 0 ? moneyPaise(aoa[index][columns.outstanding]) : 0;
    if (!total && !settled && !outstanding) continue;
    const kind = /refund|addition|credit/i.test(label) ? 'ADDITION' : 'DEDUCTION';
    adjustments.push({
      kind,
      category: /ad/i.test(label) ? 'ADS' : 'OTHER',
      totalChargePaise: total,
      settledThisCyclePaise: settled,
      outstandingCarryForwardPaise: outstanding,
      invoiceNumber: label,
      sourceTabName: 'Other charges and deductions',
      sourceRowNumber: index + 1,
    });
  }
  return adjustments;
}

/**
 * @param {unknown[][]} aoa
 */
function parseHeld(aoa) {
  const header = findHeaderRowIndex(aoa, {
    orderId: ['order id'],
    amountPaise: ['amount', 'order amount'],
    reason: ['reason', 'complaint'],
  });
  if (!header) return [];
  /** @type {Array<Record<string, unknown>>} */
  const held = [];
  for (let index = header.headerRowIndex + 1; index < aoa.length; index += 1) {
    const raw = rowObject(aoa, header.columns, index);
    if (isSummaryOrTotalRow(raw, ['orderId'])) continue;
    held.push({
      orderId: String(raw.orderId),
      amountPaise: moneyPaise(raw.amountPaise),
      reason: String(raw.reason || 'Unresolved customer complaint'),
      sourceTabName: 'Unresolved customer complaints',
      sourceRowNumber: index + 1,
    });
  }
  return held;
}

/**
 * @param {unknown[][]} aoa
 */
function readRestaurantShare(aoa) {
  for (const row of aoa) {
    for (let index = 0; index < (row || []).length; index += 1) {
      const label = String(row[index] ?? '').toLowerCase();
      if (!label.includes('restaurant share')) continue;
      const next = row[index + 1] ?? row[index];
      const match = String(next).match(/\d+(\.\d+)?/);
      if (match) return Number(match[0]);
    }
  }
  return null;
}
