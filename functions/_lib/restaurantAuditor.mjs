import { applyBps } from './currency.mjs';
import { generateClaimTicket } from './claimGenerator.mjs';

/**
 * @param {unknown} value
 */
function n(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 0;
}

/**
 * @param {number[]} values
 */
function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * @param {Record<string, unknown>} order
 */
function commissionableValue(order) {
  return (
    n(order.itemSubtotalPaise) +
    n(order.packagingChargePaise) -
    n(order.restaurantDiscountSharePaise) -
    n(order.swiggyOneOrGoldDiscountPaise)
  );
}

/**
 * @param {Record<string, unknown>} order
 */
function deductionTotal(order) {
  return (
    n(order.serviceFeePaise) +
    n(order.paymentMechanismFeePaise) +
    n(order.longDistanceFeePaise) +
    n(order.pocketHeroFeePaise) +
    n(order.taxesOnFees18PctPaise) +
    n(order.gstSection95Paise) +
    n(order.tds194OPaise) +
    n(order.tcsPaise) +
    n(order.customerCompensationPaise) +
    n(order.cancellationDeductionPaise) +
    n(order.deliveryChargeRecoveryPaise) +
    n(order.promoRecoveryPaise) +
    n(order.otherOrderDeductionPaise)
  );
}

/**
 * @param {Record<string, unknown>} statement
 * @param {Record<string, unknown>} contract
 * @param {{ posOrderIds?: string[], priorPendingLedger?: Array<Record<string, unknown>>, isOcr?: boolean }} [options]
 */
export function runRestaurantAudit(statement, contract, options = {}) {
  const orders = Array.isArray(statement?.orders) ? statement.orders : [];
  const adjustments = Array.isArray(statement?.outletAdjustments) ? statement.outletAdjustments : [];
  const heldOrders = Array.isArray(statement?.heldOrders) ? statement.heldOrders : [];
  const posOrderIds = Array.isArray(options.posOrderIds) ? options.posOrderIds.map(String) : [];
  const priorPending = Array.isArray(options.priorPendingLedger) ? options.priorPendingLedger : [];
  const isOcr = options.isOcr === true;
  const tolerance = isOcr ? 100 : 5;
  const meta = {
    platform: statement?.platform,
    payoutCycleStart: statement?.payoutCycleStart,
    payoutCycleEnd: statement?.payoutCycleEnd,
  };

  const appliedRates = [];
  for (const order of orders) {
    const base = commissionableValue(order);
    if (base > 0 && String(order.orderStatus || 'DELIVERED') === 'DELIVERED') {
      appliedRates.push(Math.round((n(order.serviceFeePaise) * 10000) / base));
    }
  }
  const effectiveCommissionBps =
    contract?.commissionBps == null ? median(appliedRates) : n(contract.commissionBps);

  /** @type {Array<Record<string, unknown>>} */
  const findings = [];
  /** @type {Array<Record<string, unknown>>} */
  const newCarryForwardEntries = [];
  const statutoryTaxSummary = {
    gstSection95Paise: 0,
    tds194OPaise: 0,
    tcsPaise: 0,
    taxesOnFees18PctPaise: 0,
  };

  /**
   * @param {Record<string, unknown>} partial
   */
  function pushFinding(partial) {
    const finding = {
      platform: statement?.platform,
      orderId: partial.orderId || '',
      orderItemId: partial.orderItemId || '',
      sku: partial.sku || '',
      findingType: partial.findingType,
      deductionBucket: partial.deductionBucket || 'CONTESTIBLE_CUT',
      expectedPaise: n(partial.expectedPaise),
      billedPaise: n(partial.billedPaise),
      recoverableVariancePaise: n(partial.recoverableVariancePaise),
      sourceTabName: partial.sourceTabName || '',
      sourceRowNumber: n(partial.sourceRowNumber),
      columnName: partial.columnName || 'Amount',
      invoiceNumber: partial.invoiceNumber || '',
      ocrConfidenceStatus: partial.ocrConfidenceStatus || 'DIGITAL',
      verificationPrompt: partial.verificationPrompt || null,
    };
    Object.assign(finding, generateClaimTicket(finding, meta));
    findings.push(finding);
  }

  for (const order of orders) {
    const expectedPayout = n(order.netOrderValuePaise) - deductionTotal(order);
    const declaredPayout = n(order.declaredOrderPayoutPaise);
    const gap = Math.abs(expectedPayout - declaredPayout);
    if (gap > tolerance) {
      if (isOcr) {
        pushFinding({
          orderId: order.orderId,
          findingType: 'ORDER_ROW_ARITHMETIC_MISMATCH',
          deductionBucket: 'CONTESTIBLE_CUT',
          expectedPaise: expectedPayout,
          billedPaise: declaredPayout,
          recoverableVariancePaise: 0,
          sourceTabName: order.sourceTabName,
          sourceRowNumber: order.sourceRowNumber,
          columnName: 'Order Payout',
          ocrConfidenceStatus: 'NEEDS_VERIFICATION',
          verificationPrompt: {
            uploadId: statement?.uploadId || '',
            rowNumber: n(order.sourceRowNumber),
            columnName: 'Order Payout',
            expectedPaise: expectedPayout,
            extractedPaise: declaredPayout,
            assignedToRole: 'MUNSHI',
          },
        });
      } else {
        pushFinding({
          orderId: order.orderId,
          findingType: 'ORDER_ROW_ARITHMETIC_MISMATCH',
          deductionBucket: 'CONTESTIBLE_CUT',
          expectedPaise: expectedPayout,
          billedPaise: declaredPayout,
          recoverableVariancePaise: gap,
          sourceTabName: order.sourceTabName,
          sourceRowNumber: order.sourceRowNumber,
          columnName: 'Order Payout',
        });
      }
    }

    const base = commissionableValue(order);
    const expectedServiceFee = base > 0 ? applyBps(base, effectiveCommissionBps) : 0;
    const excessCommission = n(order.serviceFeePaise) - expectedServiceFee;
    if (excessCommission > 100) {
      const excessGst = applyBps(excessCommission, 1800);
      pushFinding({
        orderId: order.orderId,
        findingType: 'COMMISSION_RATE_OVERCHARGE',
        deductionBucket: 'CONTRACT_FEE',
        expectedPaise: expectedServiceFee,
        billedPaise: n(order.serviceFeePaise),
        recoverableVariancePaise: excessCommission + excessGst,
        sourceTabName: order.sourceTabName,
        sourceRowNumber: order.sourceRowNumber,
        columnName: 'Service Fee',
      });
    }

    const taxableFees =
      n(order.serviceFeePaise) +
      n(order.paymentMechanismFeePaise) +
      n(order.longDistanceFeePaise) +
      n(order.pocketHeroFeePaise);
    const expectedTax = applyBps(taxableFees, 1800);
    const taxGap = n(order.taxesOnFees18PctPaise) - expectedTax;
    if (taxGap > 100) {
      pushFinding({
        orderId: order.orderId,
        findingType: 'EXCESS_GST_ON_FEES',
        deductionBucket: 'CONTRACT_FEE',
        expectedPaise: expectedTax,
        billedPaise: n(order.taxesOnFees18PctPaise),
        recoverableVariancePaise: taxGap,
        sourceTabName: order.sourceTabName,
        sourceRowNumber: order.sourceRowNumber,
        columnName: 'GST on Fees',
      });
    }

    if (n(order.longDistanceFeePaise) > 0 && !contract?.longDistanceOptedIn) {
      const fee = n(order.longDistanceFeePaise);
      pushFinding({
        orderId: order.orderId,
        findingType: 'UNCONSENTED_OPT_IN_FEE',
        deductionBucket: 'CONTESTIBLE_CUT',
        expectedPaise: 0,
        billedPaise: fee,
        recoverableVariancePaise: fee + applyBps(fee, 1800),
        sourceTabName: order.sourceTabName,
        sourceRowNumber: order.sourceRowNumber,
        columnName: 'Long Distance Fee',
      });
    }
    if (n(order.pocketHeroFeePaise) > 0 && !contract?.pocketHeroOptedIn) {
      const fee = n(order.pocketHeroFeePaise);
      pushFinding({
        orderId: order.orderId,
        findingType: 'UNCONSENTED_OPT_IN_FEE',
        deductionBucket: 'CONTESTIBLE_CUT',
        expectedPaise: 0,
        billedPaise: fee,
        recoverableVariancePaise: fee + applyBps(fee, 1800),
        sourceTabName: order.sourceTabName,
        sourceRowNumber: order.sourceRowNumber,
        columnName: 'Pocket Hero Fee',
      });
    }

    const discountShare = n(order.restaurantDiscountSharePaise) + n(order.swiggyOneOrGoldDiscountPaise);
    const allowedDiscount =
      n(order.itemSubtotalPaise) > 0
        ? applyBps(n(order.itemSubtotalPaise), n(contract?.approvedDiscountShareBps))
        : 0;
    if (
      (n(order.itemSubtotalPaise) > 0 && discountShare - allowedDiscount > 100) ||
      n(order.promoRecoveryPaise) > 0
    ) {
      const excessDiscount = Math.max(0, discountShare - allowedDiscount);
      pushFinding({
        orderId: order.orderId,
        findingType: 'EXCESS_DISCOUNT_OR_PROMO_RECOVERY',
        deductionBucket: 'CONTESTIBLE_CUT',
        expectedPaise: allowedDiscount,
        billedPaise: discountShare + n(order.promoRecoveryPaise),
        recoverableVariancePaise: excessDiscount + n(order.promoRecoveryPaise),
        sourceTabName: order.sourceTabName,
        sourceRowNumber: order.sourceRowNumber,
        columnName: 'Restaurant Discount Share',
      });
    }

    const recovery =
      n(order.customerCompensationPaise) +
      n(order.cancellationDeductionPaise) +
      n(order.deliveryChargeRecoveryPaise);
    if (
      n(order.customerCompensationPaise) > 0 ||
      n(order.cancellationDeductionPaise) > 0 ||
      n(order.deliveryChargeRecoveryPaise) > 0
    ) {
      pushFinding({
        orderId: order.orderId,
        findingType: 'CUSTOMER_COMPENSATION_OR_RECOVERY',
        deductionBucket: 'CONTESTIBLE_CUT',
        expectedPaise: 0,
        billedPaise: recovery,
        recoverableVariancePaise: recovery,
        sourceTabName: order.sourceTabName,
        sourceRowNumber: order.sourceRowNumber,
        columnName: 'Customer Compensation',
      });
    }

    statutoryTaxSummary.gstSection95Paise += n(order.gstSection95Paise);
    statutoryTaxSummary.tds194OPaise += n(order.tds194OPaise);
    statutoryTaxSummary.tcsPaise += n(order.tcsPaise);
    statutoryTaxSummary.taxesOnFees18PctPaise += n(order.taxesOnFees18PctPaise);
  }

  if (typeof contract?.approvedWeeklyAdCapPaise === 'number') {
    let adSettled = 0;
    let adInvoice = '';
    let adTab = '';
    let adRow = 0;
    for (const adjustment of adjustments) {
      if (adjustment.category !== 'ADS' || adjustment.kind === 'ADDITION') continue;
      adSettled += n(adjustment.settledThisCyclePaise);
      adInvoice = String(adjustment.invoiceNumber || adInvoice);
      adTab = String(adjustment.sourceTabName || adTab);
      adRow = n(adjustment.sourceRowNumber) || adRow;
    }
    if (adSettled - n(contract.approvedWeeklyAdCapPaise) > 100) {
      pushFinding({
        findingType: 'EXCESS_OR_UNCONSENTED_AD_SPEND',
        deductionBucket: 'CONTESTIBLE_CUT',
        expectedPaise: n(contract.approvedWeeklyAdCapPaise),
        billedPaise: adSettled,
        recoverableVariancePaise: adSettled - n(contract.approvedWeeklyAdCapPaise),
        sourceTabName: adTab,
        sourceRowNumber: adRow,
        columnName: 'Ad Spend',
        invoiceNumber: adInvoice,
      });
    }
  }

  for (const adjustment of adjustments) {
    if (n(adjustment.outstandingCarryForwardPaise) > 0) {
      newCarryForwardEntries.push({
        platform: statement?.platform,
        sourceTabName: adjustment.sourceTabName || '',
        invoiceNumber: adjustment.invoiceNumber || '',
        outstandingPaise: n(adjustment.outstandingCarryForwardPaise),
      });
    }
  }

  const orderPayoutSum = orders.reduce((sum, order) => sum + n(order.declaredOrderPayoutPaise), 0);
  const adjustmentSum = adjustments.reduce((sum, adjustment) => {
    const settled = n(adjustment.settledThisCyclePaise);
    return sum + (adjustment.kind === 'ADDITION' ? settled : -settled);
  }, 0);
  const reconciledNetPayoutPaise = orderPayoutSum + adjustmentSum;
  const declaredSummary = n(statement?.declaredSummaryNetPayoutPaise);
  if (Math.abs(reconciledNetPayoutPaise - declaredSummary) > 100) {
    pushFinding({
      findingType: 'SUMMARY_BRIDGE_UNEXPLAINED_GAP',
      deductionBucket: 'UNPAID_ORDER',
      expectedPaise: reconciledNetPayoutPaise,
      billedPaise: declaredSummary,
      recoverableVariancePaise: Math.abs(reconciledNetPayoutPaise - declaredSummary),
      sourceTabName: 'Summary',
      sourceRowNumber: 1,
      columnName: 'Net Payout',
    });
  }

  const heldIds = new Set(heldOrders.map((held) => String(held.orderId)));
  const paidIds = new Set(orders.map((order) => String(order.orderId)));
  for (const posId of posOrderIds) {
    if (heldIds.has(posId)) {
      const held = heldOrders.find((item) => String(item.orderId) === posId) || {};
      pushFinding({
        orderId: posId,
        findingType: 'HELD_ORDER_ACTION_REQUIRED',
        deductionBucket: 'HELD_ORDER',
        expectedPaise: n(held.amountPaise),
        billedPaise: 0,
        recoverableVariancePaise: 0,
        sourceTabName: held.sourceTabName || 'Unresolved customer complaints',
        sourceRowNumber: n(held.sourceRowNumber),
        columnName: 'Held Order',
      });
    } else if (!paidIds.has(posId)) {
      pushFinding({
        orderId: posId,
        findingType: 'DELIVERED_ORDER_MISSING_FROM_PAYOUT',
        deductionBucket: 'UNPAID_ORDER',
        expectedPaise: 0,
        billedPaise: 0,
        recoverableVariancePaise: 0,
        sourceTabName: 'POS',
        sourceRowNumber: 1,
        columnName: 'Order ID',
      });
    }
  }
  for (const prior of priorPending) {
    const priorId = String(prior.orderId || '');
    if (!priorId || paidIds.has(priorId)) continue;
    pushFinding({
      orderId: priorId,
      findingType: 'OVERDUE_HELD_ORDER_DISPUTE',
      deductionBucket: 'HELD_ORDER',
      expectedPaise: n(prior.amountPaise),
      billedPaise: 0,
      recoverableVariancePaise: n(prior.amountPaise),
      sourceTabName: 'Prior pending ledger',
      sourceRowNumber: n(prior.sourceRowNumber) || 1,
      columnName: 'Held Order',
    });
  }

  return {
    effectiveCommissionBps,
    findings,
    statutoryTaxSummary,
    newCarryForwardEntries,
    reconciledNetPayoutPaise,
  };
}
