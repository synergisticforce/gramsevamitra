import { applyBps, toMinorUnits } from './currency.mjs';
import { runEcommerceAudit } from './ecommerceAuditor.mjs';
import { runRestaurantAudit } from './restaurantAuditor.mjs';

/**
 * @param {unknown} value
 */
function n(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 0;
}

/**
 * @param {Record<string, unknown>} order
 */
function payoutGap(order) {
  const expected =
    n(order.netOrderValuePaise) -
    n(order.serviceFeePaise) -
    n(order.paymentMechanismFeePaise) -
    n(order.longDistanceFeePaise) -
    n(order.pocketHeroFeePaise) -
    n(order.taxesOnFees18PctPaise) -
    n(order.gstSection95Paise) -
    n(order.tds194OPaise) -
    n(order.tcsPaise) -
    n(order.customerCompensationPaise) -
    n(order.cancellationDeductionPaise) -
    n(order.deliveryChargeRecoveryPaise) -
    n(order.promoRecoveryPaise) -
    n(order.otherOrderDeductionPaise);
  const declared = n(order.declaredOrderPayoutPaise);
  return { expected, declared, gap: Math.abs(expected - declared) };
}

/**
 * @param {Record<string, unknown>} statement
 * @param {Record<string, unknown>} [_auditResult]
 * @param {{ munshiId?: string | null, isOcr?: boolean }} [options]
 */
export function inspectAndQueueOcrDiscrepancies(statement, _auditResult = {}, options = {}) {
  const orders = Array.isArray(statement?.orders) ? statement.orders : [];
  /** @type {Array<Record<string, unknown>>} */
  const queue = [];
  for (const order of orders) {
    const markedOcr = order.ocrConfidenceStatus && order.ocrConfidenceStatus !== 'DIGITAL' && order.ocrConfidenceStatus !== 'VERIFIED';
    if (!markedOcr && options.isOcr !== true) continue;
    const gap = payoutGap(order);
    if (gap.gap <= 100) continue;
    const taxable =
      n(order.serviceFeePaise) +
      n(order.paymentMechanismFeePaise) +
      n(order.longDistanceFeePaise) +
      n(order.pocketHeroFeePaise);
    const expectedTax = applyBps(taxable, 1800);
    const extractedTax = n(order.taxesOnFees18PctPaise);
    const taxDelta = Math.abs(extractedTax - expectedTax);
    const taxIsSuspect = taxDelta > 100 && Math.abs(taxDelta - gap.gap) <= 5;
    const columnName = taxIsSuspect ? 'taxesOnFees18PctPaise' : 'declaredOrderPayoutPaise';
    order.ocrConfidenceStatus = 'NEEDS_VERIFICATION';
    queue.push({
      orderId: String(order.orderId || ''),
      sourceTabName: String(order.sourceTabName || ''),
      rowNumber: n(order.sourceRowNumber),
      columnName,
      expectedPaise: taxIsSuspect ? expectedTax : gap.expected,
      extractedPaise: taxIsSuspect ? extractedTax : gap.declared,
      assignedToRole: options.munshiId ? 'MUNSHI' : 'ADMIN',
      status: 'PENDING',
    });
  }
  return { queue, statement };
}

/**
 * @param {Record<string, unknown>} statement
 * @param {Record<string, unknown>} queueItem
 * @param {unknown} correctedValue
 * @param {Record<string, unknown>} [contract]
 * @param {Record<string, unknown>} [options]
 */
export function resolveCellVerification(statement, queueItem, correctedValue, contract = {}, options = {}) {
  const rows = statement?.vertical === 'ECOMMERCE' ? statement.items : statement.orders;
  const list = Array.isArray(rows) ? rows : [];
  const row = list.find((item) => String(item.orderId) === String(queueItem.orderId));
  if (!row) {
    return { statement, queueItem, auditResult: null, horizontalGapPaise: null };
  }
  row[queueItem.columnName] = toMinorUnits(correctedValue);
  const auditResult = statement?.vertical === 'ECOMMERCE'
    ? runEcommerceAudit(statement, contract, options)
    : runRestaurantAudit(statement, contract, options);
  const gap = payoutGap(row).gap;
  if (gap <= 5) {
    row.ocrConfidenceStatus = 'VERIFIED';
    queueItem.status = 'RESOLVED';
  }
  return { statement, queueItem, auditResult, horizontalGapPaise: gap };
}
