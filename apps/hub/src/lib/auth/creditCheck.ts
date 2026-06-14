import {
  formatCreditQuoteMessage,
  getOperationCreditCost,
  getOperationLabel,
  PRO_MONTHLY_CREDIT_FUP,
} from '@shared/lib/aiCredits.mjs';

export type ProOperationId =
  | 'smart-extract'
  | 'extract'
  | 'career-ai'
  | 'media-process'
  | 'file-converter'
  | 'smart-router';

export interface UserCreditsResponse {
  success?: boolean;
  credits?: number;
  plan?: string;
  monthlyAllowance?: number;
  message?: string;
  error?: string;
}

export interface CreditQuote {
  operationId: ProOperationId;
  label: string;
  cost: number;
  balance: number;
  canAfford: boolean;
  message: string;
}

export { PRO_MONTHLY_CREDIT_FUP, getOperationCreditCost, getOperationLabel, formatCreditQuoteMessage };

/** Fetch live AI Credit balance from D1 via edge API. */
export async function fetchUserCredits(): Promise<number> {
  const response = await fetch('/api/user/credits', { credentials: 'include' });
  const payload = (await response.json()) as UserCreditsResponse;

  if (!response.ok || typeof payload.credits !== 'number') {
    throw new Error(payload.message ?? payload.error ?? 'Could not load AI Credit balance.');
  }

  return payload.credits;
}

export function buildCreditQuote(operationId: ProOperationId, balance: number): CreditQuote {
  const cost = getOperationCreditCost(operationId);
  return {
    operationId,
    label: getOperationLabel(operationId),
    cost,
    balance,
    canAfford: balance >= cost,
    message: formatCreditQuoteMessage(cost, balance),
  };
}

export function parseCreditApiError(
  status: number,
  payload: { message?: string; error?: string; requiredCredits?: number; remainingCredits?: number },
  fallback: string,
): string {
  if (status === 402) {
    const required = payload.requiredCredits;
    const remaining = payload.remainingCredits;
    if (typeof required === 'number' && typeof remaining === 'number') {
      return `Insufficient AI Credits. This operation requires ${required}; you have ${remaining}.`;
    }
    return payload.message ?? 'Insufficient AI Credits for this Pro operation.';
  }
  return payload.message ?? payload.error ?? fallback;
}
