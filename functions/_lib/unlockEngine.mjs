import { applyBps } from './currency.mjs';

const FREE_UNLOCK_LIMIT_PAISE = 20000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * @param {unknown} value
 */
function n(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 0;
}

/**
 * @param {Record<string, unknown>} auditResult
 */
export function totalRecoverablePaise(auditResult) {
  if (Number.isFinite(auditResult?.totalRecoverablePaise)) return Math.trunc(auditResult.totalRecoverablePaise);
  const findings = Array.isArray(auditResult?.findings) ? auditResult.findings : [];
  return findings.reduce((sum, finding) => sum + n(finding?.recoverableVariancePaise), 0);
}

/**
 * @param {unknown} value
 */
export function maskOrderIdentifier(value) {
  const text = String(value ?? '');
  if (!text) return '';
  if (text.length <= 4) return '****';
  return `${text.slice(0, 4)}****${text.slice(-2)}`;
}

/**
 * @param {Record<string, unknown>} auditResult
 * @param {{ isPro?: boolean, forceUnlocked?: boolean }} [options]
 */
export function applyFreemiumTeaserMask(auditResult, options = {}) {
  const total = totalRecoverablePaise(auditResult);
  const findings = (Array.isArray(auditResult?.findings) ? auditResult.findings : []).map((finding) => ({ ...finding }));
  const proRate = options.isPro === true || options.subscriptionTier === 'PRO_299';
  const open = total < FREE_UNLOCK_LIMIT_PAISE || options.forceUnlocked === true;
  if (open) {
    return {
      ...auditResult,
      findings: findings.map((finding) => ({ ...finding, isSampleProof: false, isMasked: false })),
      totalRecoverablePaise: total,
      isUnlocked: true,
      unlockFeePaise: 0,
      ownerPocketPaise: total,
      maskedCount: 0,
    };
  }

  const unlockFeePaise = applyBps(total, proRate ? 500 : 1000);
  return {
    ...auditResult,
    findings: findings.map((finding, index) => {
      if (index === 0) return { ...finding, isSampleProof: true, isMasked: false };
      return {
        ...finding,
        isSampleProof: false,
        isMasked: true,
        orderId: maskOrderIdentifier(finding.orderId),
        orderItemId: finding.orderItemId ? maskOrderIdentifier(finding.orderItemId) : finding.orderItemId,
        claimTicketEn: 'Unlock to read this support ticket.',
        claimTicketHi: 'अनलॉक करने पर यह टिकट खुलेगा।',
      };
    }),
    totalRecoverablePaise: total,
    isUnlocked: false,
    unlockFeePaise,
    ownerPocketPaise: total - unlockFeePaise,
    maskedCount: Math.max(0, findings.length - 1),
  };
}

/**
 * @param {string} uploadId
 * @param {number} unlockFeePaise
 * @param {'TRUST_CLOCK_MANDATE' | 'ONE_TAP_UPI' | 'PRO_299'} mode
 * @param {{ now?: string | number | Date }} [options]
 */
export function buildCompliantUnlockCheckout(uploadId, unlockFeePaise, mode, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const day10ReminderAt = new Date(now.getTime() + 10 * DAY_MS).toISOString();
  const day14SettlementAt = new Date(now.getTime() + 14 * DAY_MS).toISOString();
  const day12PreDebitNoticeAt = new Date(new Date(day14SettlementAt).getTime() - 48 * 60 * 60 * 1000).toISOString();
  const fee = n(unlockFeePaise);
  if (mode === 'TRUST_CLOCK_MANDATE') {
    return {
      uploadId,
      mode,
      authAmountPaise: 100,
      maxAmountPaise: fee,
      amountPaise: 100,
      currency: 'INR',
      day10ReminderAt,
      day12PreDebitNoticeAt,
      day14SettlementAt,
      refundGuaranteeDays: 14,
    };
  }
  if (mode === 'PRO_299') {
    return {
      uploadId,
      mode,
      amountPaise: 29900,
      currency: 'INR',
      day10ReminderAt,
      day12PreDebitNoticeAt,
      day14SettlementAt,
      refundGuaranteeDays: 14,
    };
  }
  return {
    uploadId,
    mode: 'ONE_TAP_UPI',
    amountPaise: fee,
    currency: 'INR',
    day10ReminderAt,
    day12PreDebitNoticeAt,
    day14SettlementAt,
    refundGuaranteeDays: 14,
  };
}

/**
 * @param {number} revenueCollectedPaise
 * @param {number} [commissionShareBps]
 */
export function calculateMunshiCommission(revenueCollectedPaise, commissionShareBps = 3000) {
  return applyBps(n(revenueCollectedPaise), n(commissionShareBps));
}

/**
 * @param {Record<string, unknown>} finding
 * @param {number} unlockFeePaise
 * @param {number} totalRecoverable
 * @param {unknown} rejectionTicketId
 */
export function processRejectedClaimRefund(finding, unlockFeePaise, totalRecoverable, rejectionTicketId) {
  const ticket = String(rejectionTicketId ?? '').trim();
  if (!ticket) {
    const error = new Error('A platform rejection ticket id is required.');
    error.code = 'REJECTION_TICKET_REQUIRED';
    throw error;
  }
  const base = n(totalRecoverable);
  if (base <= 0) {
    const error = new Error('There is no recoverable amount to refund against.');
    error.code = 'REFUND_BASE_EMPTY';
    throw error;
  }
  const refundPaise = Math.round((n(finding?.recoverableVariancePaise) * n(unlockFeePaise)) / base);
  finding.claimStatus = 'REJECTED_REFUNDED';
  finding.rejectionTicketId = ticket;
  finding.refundPaise = refundPaise;
  return {
    finding,
    refundPaise,
    claimStatus: 'REJECTED_REFUNDED',
    rejectionTicketId: ticket,
  };
}
