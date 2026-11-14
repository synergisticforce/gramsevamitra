/**
 * Everyday money helpers. Payout audits stay in integer paise.
 * These calculators are for the on-screen livelihood tools.
 */

/** Simple annual rate from a monthly informal percent. 2% a month is 24% a year. */
export function informalSimpleAprPercent(monthlyPercent) {
  const monthly = Number(monthlyPercent);
  if (!Number.isFinite(monthly) || monthly < 0) return 0;
  return Math.round(monthly * 12 * 100) / 100;
}

/** Compound annual rate from a monthly percent. */
export function informalCompoundAprPercent(monthlyPercent) {
  const monthly = Number(monthlyPercent);
  if (!Number.isFinite(monthly) || monthly < 0) return 0;
  const apr = (Math.pow(1 + monthly / 100, 12) - 1) * 100;
  return Math.round(apr * 100) / 100;
}

export function standardEmiPaise(principalPaise, annualPercent, months) {
  const principal = Math.round(Number(principalPaise) || 0);
  const n = Math.round(Number(months) || 0);
  const annual = Number(annualPercent) || 0;
  if (principal <= 0 || n <= 0) return 0;
  const monthlyRate = annual / 12 / 100;
  if (monthlyRate === 0) return Math.round(principal / n);
  const factor = Math.pow(1 + monthlyRate, n);
  return Math.round((principal * monthlyRate * factor) / (factor - 1));
}

export const CURRENCY_SYMBOLS = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  NGN: '₦',
};

export function currencySymbol(code) {
  return CURRENCY_SYMBOLS[String(code || 'INR').toUpperCase()] || '₹';
}
