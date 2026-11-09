export type { DeductionBucket } from './types';

export interface RestaurantOrderInput {
  orderId: string;
  orderStatus?: 'DELIVERED' | 'CANCELLED';
  itemSubtotalPaise: number;
  packagingChargePaise?: number;
  restaurantDiscountSharePaise?: number;
  swiggyOneOrGoldDiscountPaise?: number;
  netOrderValuePaise: number;
  serviceFeePaise: number;
  paymentMechanismFeePaise?: number;
  longDistanceFeePaise?: number;
  pocketHeroFeePaise?: number;
  taxesOnFees18PctPaise?: number;
  gstSection95Paise?: number;
  tds194OPaise?: number;
  tcsPaise?: number;
  customerCompensationPaise?: number;
  cancellationDeductionPaise?: number;
  deliveryChargeRecoveryPaise?: number;
  promoRecoveryPaise?: number;
  otherOrderDeductionPaise?: number;
  declaredOrderPayoutPaise: number;
  sourceTabName: string;
  sourceRowNumber: number;
}

export interface RestaurantContractInput {
  commissionBps?: number | null;
  longDistanceOptedIn?: boolean;
  pocketHeroOptedIn?: boolean;
  approvedWeeklyAdCapPaise?: number;
  approvedDiscountShareBps?: number;
}

export interface RestaurantAuditResult {
  effectiveCommissionBps: number;
  findings: Array<Record<string, unknown>>;
  statutoryTaxSummary: {
    gstSection95Paise: number;
    tds194OPaise: number;
    tcsPaise: number;
    taxesOnFees18PctPaise: number;
  };
  newCarryForwardEntries: Array<Record<string, unknown>>;
  reconciledNetPayoutPaise: number;
}

import { runRestaurantAudit as runRestaurantAuditJs } from '../../../../../functions/_lib/restaurantAuditor.mjs';

export function runRestaurantAudit(
  statement: Record<string, unknown>,
  contract: RestaurantContractInput,
  options?: Record<string, unknown>,
): RestaurantAuditResult {
  return runRestaurantAuditJs(
    statement,
    contract as unknown as Record<string, unknown>,
    options,
  );
}
