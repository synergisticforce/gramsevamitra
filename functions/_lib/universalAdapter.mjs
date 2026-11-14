import {
  findHeaderRowIndex,
  isSummaryOrTotalRow,
  moneyPaise,
  normalizeHeader,
  rowObject,
  scrubCustomerPiiRow,
  sheetToAoa,
} from './adapters/baseAdapter.mjs';

const ALIASES = {
  orderId: ['order id', 'order', 'ref id', 'reference', 'receipt', 'transaction id'],
  grossPaise: ['gross', 'sale amount', 'sales', 'subtotal', 'item total', 'gross amount'],
  feePaise: ['fee', 'commission', 'service fee', 'platform fee'],
  shippingPaise: ['shipping', 'delivery', 'delivery fee'],
  taxPaise: ['tax', 'gst', 'vat'],
  declaredOrderPayoutPaise: ['net', 'settled', 'payout', 'net payout', 'net settled'],
};

/**
 * @param {import('xlsx').WorkBook} workbook
 */
export function parseUniversalWorkbook(workbook) {
  let best = null;
  for (const name of workbook.SheetNames || []) {
    const aoa = sheetToAoa(workbook, name);
    const header = findHeaderRowIndex(aoa, ALIASES);
    if (header?.columns?.orderId == null) continue;
    if (header.columns.grossPaise == null || header.columns.declaredOrderPayoutPaise == null) continue;
    if (!best || Object.keys(header.columns).length > Object.keys(best.header.columns).length) {
      best = { name, aoa, header };
    }
  }
  if (!best) return null;

  const orders = [];
  for (let index = best.header.headerRowIndex + 1; index < best.aoa.length; index += 1) {
    const raw = scrubCustomerPiiRow(rowObject(best.aoa, best.header.columns, index));
    if (isSummaryOrTotalRow(raw, ['orderId'])) {
      continue;
    }
    const gross = moneyPaise(raw.grossPaise);
    const fee = moneyPaise(raw.feePaise);
    const shipping = moneyPaise(raw.shippingPaise);
    const tax = moneyPaise(raw.taxPaise);
    const declared = moneyPaise(raw.declaredOrderPayoutPaise);
    if (!gross && !declared) continue;
    orders.push({
      orderId: String(raw.orderId || `ROW-${index + 1}`),
      orderStatus: 'SETTLED',
      itemSubtotalPaise: gross,
      grossPaise: gross,
      serviceFeePaise: fee,
      feePaise: fee,
      shippingPaise: shipping,
      taxPaise: tax,
      declaredOrderPayoutPaise: declared,
      sourceTabName: best.name,
      sourceRowNumber: index + 1,
    });
  }
  if (!orders.length) return null;

  const headers = (best.aoa[best.header.headerRowIndex] || []).map((cell) => normalizeHeader(cell));
  return {
    platform: 'UNIVERSAL',
    vertical: 'UNIVERSAL',
    currencyCode: 'MINOR',
    minorUnitScale: 100,
    outletName: 'Uploaded payout',
    payoutCycleStart: '',
    payoutCycleEnd: '',
    bankUtr: '',
    declaredSummaryNetPayoutPaise: orders.reduce((sum, order) => sum + order.declaredOrderPayoutPaise, 0),
    orders,
    items: [],
    outletAdjustments: [],
    heldOrders: [],
    warnings: [],
    piiColumnsDropped: headers.filter((header) => /name|phone|mobile|address|email/.test(header)),
  };
}

/**
 * @param {Record<string, unknown>} statement
 */
export function auditUniversalStatement(statement) {
  const orders = Array.isArray(statement?.orders) ? statement.orders : [];
  const findings = [];
  for (const order of orders) {
    const expected = Number(order.grossPaise || 0) - Number(order.feePaise || 0) - Number(order.shippingPaise || 0) - Number(order.taxPaise || 0);
    const declared = Number(order.declaredOrderPayoutPaise || 0);
    const gap = expected - declared;
    if (gap === 0) continue;
    findings.push({
      findingType: gap > 0 ? 'SHORT_SETTLEMENT' : 'NEGATIVE_ANOMALY',
      orderId: String(order.orderId || ''),
      recoverableVariancePaise: gap > 0 ? gap : 0,
      expectedPaise: expected,
      billedPaise: declared,
      claimTicketEn: gap > 0
        ? `Order ${order.orderId} settled ${declared} minor units. Gross minus fees is ${expected}.`
        : `Order ${order.orderId} net is higher than gross minus fees. Check the row.`,
      claimTicketHi: gap > 0 ? `ऑर्डर ${order.orderId} कम जमा हुआ।` : `ऑर्डर ${order.orderId} की पंक्ति जाँचें।`,
      sourceTabName: order.sourceTabName || 'Payout',
      sourceRowNumber: order.sourceRowNumber || 0,
      deductionBucket: 'CONTRACT_FEE',
    });
  }
  return {
    findings,
    totalRecoverablePaise: findings.reduce((sum, finding) => sum + finding.recoverableVariancePaise, 0),
    vertical: 'UNIVERSAL',
  };
}
