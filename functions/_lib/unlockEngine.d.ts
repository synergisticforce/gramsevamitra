export function totalRecoverablePaise(auditResult: Record<string, unknown>): number;
export function maskOrderIdentifier(value: unknown): string;
export function applyFreemiumTeaserMask(
  auditResult: Record<string, unknown>,
  options?: { isPro?: boolean; forceUnlocked?: boolean; subscriptionTier?: string },
): Record<string, unknown> & {
  findings: Array<Record<string, unknown>>;
  totalRecoverablePaise: number;
  isUnlocked: boolean;
  unlockFeePaise: number;
  ownerPocketPaise: number;
  maskedCount: number;
};
export function buildCompliantUnlockCheckout(
  uploadId: string,
  unlockFeePaise: number,
  mode: 'TRUST_CLOCK_MANDATE' | 'ONE_TAP_UPI' | 'PRO_299',
  options?: { now?: string | number | Date },
): {
  uploadId: string;
  mode: string;
  amountPaise: number;
  currency: string;
  authAmountPaise?: number;
  maxAmountPaise?: number;
  day10ReminderAt: string;
  day12PreDebitNoticeAt: string;
  day14SettlementAt: string;
  refundGuaranteeDays: number;
};
export function calculateMunshiCommission(revenueCollectedPaise: number, commissionShareBps?: number): number;
export function processRejectedClaimRefund(
  finding: Record<string, unknown>,
  unlockFeePaise: number,
  totalRecoverable: number,
  rejectionTicketId: unknown,
): {
  finding: Record<string, unknown>;
  refundPaise: number;
  claimStatus: string;
  rejectionTicketId: string;
};
