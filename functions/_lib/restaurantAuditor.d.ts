export function runRestaurantAudit(
  statement: object,
  contract: object,
  options?: object,
): {
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
};
