import {
  findHeaderRowIndex,
  findSheetName,
  isSummaryOrTotalRow,
  moneyPaise,
  rowObject,
  sheetToAoa,
} from './baseAdapter.mjs';

const ORDER_ALIASES = {
  orderId: ['order id'],
  itemSubtotalPaise: ['subtotal (items total)', 'subtotal'],
  packagingChargePaise: ['packaging charge'],
  restaurantDiscountSharePaise: ['restaurant discount'],
  netOrderValuePaise: ['net order value'],
  serviceFeePaise: ['service fee'],
  paymentMechanismFeePaise: ['payment mechanism fee'],
  taxesOnFees18PctPaise: ['taxes on service', 'taxes on service & payment mechanism fees'],
  tcsPaise: ['tax collected at source'],
  tds194OPaise: ['tds 194o amount', 'tds 194o'],
  gstSection95Paise: ['section 9(5)', 'gst paid by zomato'],
  customerCompensationPaise: ['customer compensation'],
  deliveryChargeRecoveryPaise: ['delivery charges recovery', 'delivery charge recovery'],
  promoRecoveryPaise: ['promo recovery'],
  otherOrderDeductionPaise: ['credit note', 'debit note'],
  declaredOrderPayoutPaise: ['order level payout', 'order payout'],
  bankUtr: ['bank utr'],
};

/**
 * @param {import('xlsx').WorkBook} workbook
 */
export function isZomatoWorkbook(workbook) {
  const names = workbook.SheetNames.join(' ').toLowerCase();
  return names.includes('zomato') || names.includes('addition deduction');
}

/**
 * @param {import('xlsx').WorkBook} workbook
 */
export function parseZomatoWorkbook(workbook) {
  const summaryName = findSheetName(workbook, /summary|payout breakup/);
  const summaryAoa = sheetToAoa(workbook, summaryName);
  const orderSheet = findSheetName(workbook, /^order level$/);
  const orders = parseOrders(sheetToAoa(workbook, orderSheet));
  const additionSheet = findSheetName(workbook, /addition deductions details|addition deduction details/);
  const outletAdjustments = parseAdditions(sheetToAoa(workbook, additionSheet));
  const summary = readLabeled(summaryAoa);
  const orderSum = orders.reduce((sum, row) => sum + row.declaredOrderPayoutPaise, 0);
  const adjustmentSum = outletAdjustments.reduce(
    (sum, row) => sum + (row.kind === 'ADDITION' ? row.settledThisCyclePaise : -row.settledThisCyclePaise),
    0,
  );
  const utr = orders.find((row) => row.bankUtr)?.bankUtr || summary.bankUtr;

  return {
    platform: 'ZOMATO',
    vertical: 'RESTAURANT',
    currencyCode: 'INR',
    minorUnitScale: 100,
    payoutCycleStart: summary.payoutCycleStart,
    payoutCycleEnd: summary.payoutCycleEnd,
    bankUtr: utr,
    declaredSummaryNetPayoutPaise: summary.declaredSummaryNetPayoutPaise ?? orderSum + adjustmentSum,
    orders,
    items: [],
    outletAdjustments,
    heldOrders: [],
    warnings: [],
    restaurantSharePercent: null,
  };
}

/**
 * @param {unknown[][]} aoa
 */
function readLabeled(aoa) {
  /** @type {Record<string, unknown>} */
  const found = {};
  for (const row of aoa) {
    const label = String(row?.[0] ?? '').toLowerCase();
    if (label.includes('cycle start')) found.start = String(row[1] ?? '');
    if (label.includes('cycle end') || label.includes('settlement date')) found.end = String(row[1] ?? '');
    if (label.includes('net payout')) found.net = row[1];
    if (label.includes('utr')) found.utr = String(row[1] ?? '');
  }
  return {
    payoutCycleStart: String(found.start || ''),
    payoutCycleEnd: String(found.end || ''),
    bankUtr: String(found.utr || ''),
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
    const net = raw.netOrderValuePaise === '' || raw.netOrderValuePaise == null
      ? item + packaging - restaurantDiscount
      : moneyPaise(raw.netOrderValuePaise);
    const serviceFee = moneyPaise(raw.serviceFeePaise);
    const paymentFee = moneyPaise(raw.paymentMechanismFeePaise);
    const tax = moneyPaise(raw.taxesOnFees18PctPaise);
    const tcs = moneyPaise(raw.tcsPaise);
    const tds = moneyPaise(raw.tds194OPaise);
    const gst95 = moneyPaise(raw.gstSection95Paise);
    const compensation = moneyPaise(raw.customerCompensationPaise);
    const delivery = moneyPaise(raw.deliveryChargeRecoveryPaise);
    const promo = moneyPaise(raw.promoRecoveryPaise);
    const other = moneyPaise(raw.otherOrderDeductionPaise);
    const computed = net - serviceFee - paymentFee - tax - tcs - tds - gst95 - compensation - delivery - promo - other;
    const declared = raw.declaredOrderPayoutPaise === '' || raw.declaredOrderPayoutPaise == null
      ? computed
      : moneyPaise(raw.declaredOrderPayoutPaise);
    orders.push({
      orderId: String(raw.orderId),
      orderStatus: 'DELIVERED',
      itemSubtotalPaise: item,
      packagingChargePaise: packaging,
      restaurantDiscountSharePaise: restaurantDiscount,
      swiggyOneOrGoldDiscountPaise: 0,
      netOrderValuePaise: net,
      serviceFeePaise: serviceFee,
      paymentMechanismFeePaise: paymentFee,
      longDistanceFeePaise: 0,
      pocketHeroFeePaise: 0,
      taxesOnFees18PctPaise: tax,
      gstSection95Paise: gst95,
      tds194OPaise: tds,
      tcsPaise: tcs,
      customerCompensationPaise: compensation,
      cancellationDeductionPaise: 0,
      deliveryChargeRecoveryPaise: delivery,
      promoRecoveryPaise: promo,
      otherOrderDeductionPaise: other,
      declaredOrderPayoutPaise: declared,
      bankUtr: String(raw.bankUtr || ''),
      sourceTabName: 'Order Level',
      sourceRowNumber: index + 1,
      rawRowJson: JSON.stringify(raw),
    });
  }
  return orders;
}

/**
 * Tracks Addition Type versus Deduction Type as the sheet walks downward.
 * @param {unknown[][]} aoa
 */
function parseAdditions(aoa) {
  /** @type {Array<Record<string, unknown>>} */
  const adjustments = [];
  /** @type {'ADDITION' | 'DEDUCTION'} */
  let kind = 'DEDUCTION';
  /** @type {{ particulars: number, settled: number, outstanding: number } | null} */
  let columns = null;
  for (let index = 0; index < aoa.length; index += 1) {
    const cells = (aoa[index] || []).map((cell) => String(cell ?? '').toLowerCase().replace(/\s+/g, ' ').trim());
    const line = cells.join(' ');
    if (line.includes('addition type')) {
      kind = 'ADDITION';
      columns = null;
    }
    if (line.includes('deduction type')) {
      kind = 'DEDUCTION';
      columns = null;
    }
    if (cells.some((cell) => cell === 'settled' || cell === 'amount')) {
      columns = {
        particulars: cells.findIndex((cell) => cell === 'particulars' || cell === 'type' || cell === 'description'),
        settled: cells.findIndex((cell) => cell === 'settled' || cell === 'amount'),
        outstanding: cells.findIndex((cell) => cell === 'outstanding'),
      };
      continue;
    }
    if (!columns || cells.every((cell) => !cell)) continue;
    const label = String(aoa[index]?.[Math.max(columns.particulars, 0)] ?? '');
    if (isSummaryOrTotalRow({ orderId: label }, ['orderId'])) continue;
    const settled = columns.settled >= 0 ? moneyPaise(aoa[index][columns.settled]) : 0;
    const outstanding = columns.outstanding >= 0 ? moneyPaise(aoa[index][columns.outstanding]) : 0;
    if (!settled && !outstanding) continue;
    adjustments.push({
      kind,
      category: /ad/i.test(label) ? 'ADS' : 'OTHER',
      totalChargePaise: settled + outstanding,
      settledThisCyclePaise: settled,
      outstandingCarryForwardPaise: outstanding,
      invoiceNumber: label,
      sourceTabName: 'Addition Deductions Details',
      sourceRowNumber: index + 1,
    });
  }
  return adjustments;
}
