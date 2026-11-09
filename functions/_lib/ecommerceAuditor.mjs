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
function mode(values) {
  if (!values.length) return 0;
  /** @type {Map<number, number>} */
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  let best = values[0];
  let bestCount = -1;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/**
 * @param {Record<string, unknown>} row
 */
function billedDeductions(row) {
  return (
    n(row.marketplaceCommissionPaise) +
    n(row.fixedOrClosingFeePaise) +
    n(row.collectionFeePaise) +
    n(row.forwardShippingFeePaise) +
    n(row.reverseShippingFeePaise) +
    n(row.gstOnFees18PctPaise) +
    n(row.tcsSec52Paise) +
    n(row.tds194OPaise) +
    n(row.otherDeductionPaise) -
    n(row.spfOrReimbursementPaise)
  );
}

/**
 * @param {Record<string, unknown>} statement
 * @param {Record<string, unknown>} contract
 * @param {{ priorPendingLedger?: Array<Record<string, unknown>>, isOcr?: boolean }} [options]
 */
export function runEcommerceAudit(statement, contract, options = {}) {
  const items = Array.isArray(statement?.items) ? statement.items : [];
  const adjustments = Array.isArray(statement?.outletAdjustments) ? statement.outletAdjustments : [];
  const isOcr = options.isOcr === true;
  const meta = {
    platform: statement?.platform,
    payoutCycleStart: statement?.payoutCycleStart,
    payoutCycleEnd: statement?.payoutCycleEnd,
  };
  /** @type {Array<Record<string, unknown>>} */
  const findings = [];

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
      deductionBucket: partial.deductionBucket || 'LOGISTICS_OVERCHARGE',
      expectedPaise: n(partial.expectedPaise),
      billedPaise: n(partial.billedPaise),
      recoverableVariancePaise: n(partial.recoverableVariancePaise),
      sourceTabName: partial.sourceTabName || '',
      sourceRowNumber: n(partial.sourceRowNumber),
      columnName: partial.columnName || 'Amount',
      billedWeightGrams: partial.billedWeightGrams,
      ocrConfidenceStatus: isOcr ? 'NEEDS_CLOUD' : 'DIGITAL',
    };
    Object.assign(finding, generateClaimTicket(finding, meta));
    findings.push(finding);
  }

  /** @type {Map<string, Record<string, unknown>[]>} */
  const bySku = new Map();
  for (const item of items) {
    const sku = String(item.sku || '');
    const list = bySku.get(sku) || [];
    list.push(item);
    bySku.set(sku, list);
  }

  /** @type {Map<string, number>} */
  const reverseCount = new Map();
  for (const item of items) {
    if (n(item.reverseShippingFeePaise) <= 0) continue;
    const key = String(item.orderItemId || `${item.orderId}|${item.sku}|${item.transactionType}`);
    reverseCount.set(key, (reverseCount.get(key) || 0) + 1);
  }

  for (const item of items) {
    const sku = String(item.sku || '');
    const skuRows = bySku.get(sku) || [item];
    const saleRows = skuRows.filter((row) => row.transactionType === 'SALE' && n(row.grossSalePaise) > 0);
    const mappedWeight = contract?.skuWeightMapGrams?.[sku];
    const modalWeight = mode(skuRows.map((row) => n(row.billedWeightGrams)).filter((weight) => weight > 0));
    const baselineWeight = typeof mappedWeight === 'number' ? mappedWeight : modalWeight;
    const normalShipRows = skuRows.filter((row) => n(row.billedWeightGrams) <= baselineWeight);
    const baselineShip = mode(
      (normalShipRows.length ? normalShipRows : skuRows).map((row) => n(row.forwardShippingFeePaise)),
    );
    const billedWeight = n(item.billedWeightGrams);
    const billedShip = n(item.forwardShippingFeePaise);
    const heavier = baselineWeight > 0 && billedWeight > baselineWeight;
    const excessShip = billedShip - baselineShip;
    if (item.transactionType === 'SALE' && (heavier || excessShip > 100)) {
      const commission = n(item.marketplaceCommissionPaise);
      const fixed = n(item.fixedOrClosingFeePaise);
      const collection = n(item.collectionFeePaise);
      const expectedGst = applyBps(commission + fixed + collection + Math.max(0, baselineShip), 1800);
      const gstGap = n(item.gstOnFees18PctPaise) - expectedGst;
      const excessGst = excessShip > 0 && gstGap > 100 ? Math.min(gstGap, applyBps(excessShip, 1800)) : 0;
      pushFinding({
        orderId: item.orderId,
        orderItemId: item.orderItemId,
        sku,
        findingType: 'SKU_WEIGHT_OR_SHIPPING_OVERCHARGE',
        deductionBucket: 'LOGISTICS_OVERCHARGE',
        expectedPaise: Math.max(0, baselineShip),
        billedPaise: billedShip,
        recoverableVariancePaise: Math.max(0, excessShip) + excessGst,
        sourceTabName: item.sourceTabName,
        sourceRowNumber: item.sourceRowNumber,
        columnName: 'Forward Shipping Fee',
        billedWeightGrams: billedWeight,
      });
    }

    if (item.transactionType === 'SALE' && n(item.grossSalePaise) > 0) {
      const appliedBps = Math.round((n(item.marketplaceCommissionPaise) * 10000) / n(item.grossSalePaise));
      const modalBps = mode(
        saleRows.map((row) => Math.round((n(row.marketplaceCommissionPaise) * 10000) / n(row.grossSalePaise))),
      );
      const rate = contract?.categoryCommissionBps == null ? modalBps : n(contract.categoryCommissionBps);
      const expectedCommission = applyBps(n(item.grossSalePaise), rate);
      const excess = n(item.marketplaceCommissionPaise) - expectedCommission;
      if (excess > 100) {
        pushFinding({
          orderId: item.orderId,
          orderItemId: item.orderItemId,
          sku,
          findingType: 'CATEGORY_COMMISSION_OVERCHARGE',
          deductionBucket: 'CONTRACT_FEE',
          expectedPaise: expectedCommission,
          billedPaise: n(item.marketplaceCommissionPaise),
          recoverableVariancePaise: excess + applyBps(excess, 1800),
          sourceTabName: item.sourceTabName,
          sourceRowNumber: item.sourceRowNumber,
          columnName: 'Marketplace Commission',
        });
      }
    }

    const itemKey = String(item.orderItemId || `${item.orderId}|${item.sku}|${item.transactionType}`);
    const duplicateReverse = (reverseCount.get(itemKey) || 0) > 1 && n(item.reverseShippingFeePaise) > 0;
    if (
      (item.orderStatus === 'DELIVERED' && n(item.reverseShippingFeePaise) > 0) ||
      duplicateReverse
    ) {
      pushFinding({
        orderId: item.orderId,
        orderItemId: item.orderItemId,
        sku,
        findingType: 'INVALID_RTO_OR_REVERSE_SHIPPING',
        deductionBucket: 'LOGISTICS_OVERCHARGE',
        expectedPaise: 0,
        billedPaise: n(item.reverseShippingFeePaise),
        recoverableVariancePaise: n(item.reverseShippingFeePaise),
        sourceTabName: item.sourceTabName,
        sourceRowNumber: item.sourceRowNumber,
        columnName: 'Reverse Shipping Fee',
      });
    }

    if (
      item.transactionType === 'RETURN' ||
      item.orderStatus === 'CUSTOMER_RETURN' ||
      item.transactionType === 'CUSTOMER_RETURN'
    ) {
      const stuck = n(item.marketplaceCommissionPaise) + n(item.tcsSec52Paise);
      if (n(item.marketplaceCommissionPaise) > 0 || n(item.tcsSec52Paise) > 0) {
        pushFinding({
          orderId: item.orderId,
          orderItemId: item.orderItemId,
          sku,
          findingType: 'UNREVERSED_COMMISSION_OR_TCS',
          deductionBucket: 'CONTRACT_FEE',
          expectedPaise: 0,
          billedPaise: stuck,
          recoverableVariancePaise: stuck,
          sourceTabName: item.sourceTabName,
          sourceRowNumber: item.sourceRowNumber,
          columnName: 'Marketplace Commission',
        });
      }
    }

    if (item.transactionType === 'SALE' && item.orderStatus === 'DELIVERED') {
      const expectedSettled = n(item.grossSalePaise) - billedDeductions(item);
      const shortfall = expectedSettled - n(item.declaredSettledPaise);
      if (n(item.declaredSettledPaise) <= 0 || shortfall > 100) {
        pushFinding({
          orderId: item.orderId,
          orderItemId: item.orderItemId,
          sku,
          findingType: 'UNPAID_DELIVERED_ORDER',
          deductionBucket: 'UNPAID_ORDER',
          expectedPaise: expectedSettled,
          billedPaise: n(item.declaredSettledPaise),
          recoverableVariancePaise: Math.max(0, shortfall),
          sourceTabName: item.sourceTabName,
          sourceRowNumber: item.sourceRowNumber,
          columnName: 'Settled Amount',
        });
      }
    }
  }

  const settledSum = items.reduce((sum, item) => sum + n(item.declaredSettledPaise), 0);
  const adjustmentSum = adjustments.reduce((sum, adjustment) => {
    const settled = n(adjustment.settledThisCyclePaise);
    return sum + (adjustment.kind === 'ADDITION' ? settled : -settled);
  }, 0);
  const reconciledNetPayoutPaise = settledSum + adjustmentSum;
  const declaredSummary = n(statement?.declaredSummaryNetPayoutPaise);
  if (Math.abs(reconciledNetPayoutPaise - declaredSummary) > 100) {
    pushFinding({
      findingType: 'NEFT_BRIDGE_MISMATCH',
      deductionBucket: 'UNPAID_ORDER',
      expectedPaise: reconciledNetPayoutPaise,
      billedPaise: declaredSummary,
      recoverableVariancePaise: Math.abs(reconciledNetPayoutPaise - declaredSummary),
      sourceTabName: 'NEFT',
      sourceRowNumber: 1,
      columnName: 'Declared NEFT',
    });
  }

  return { findings, reconciledNetPayoutPaise };
}
