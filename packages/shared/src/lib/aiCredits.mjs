/** Pro AI Credit costs — keep in sync with functions/_lib/creditEconomy.mjs */
export const PRO_MONTHLY_CREDIT_FUP = 30;

/** @typedef {keyof typeof PRO_OPERATION_COSTS} ProOperationId */

export const PRO_OPERATION_COSTS = {
  'smart-extract': 2,
  extract: 2,
  'career-ai': 3,
  'media-process': 2,
  'file-converter': 2,
  'smart-router': 2,
};

export const PRO_OPERATION_LABELS = {
  'smart-extract': 'Smart Document Extract',
  extract: 'Smart Document Extract',
  'career-ai': 'Career Pro AI',
  'media-process': 'Media Pro GPU',
  'file-converter': 'High-Fidelity Converter',
  'smart-router': 'Smart Router',
};

/**
 * @param {string} operationId
 */
export function getOperationCreditCost(operationId) {
  return PRO_OPERATION_COSTS[operationId] ?? 1;
}

/**
 * @param {string} operationId
 */
export function getOperationLabel(operationId) {
  return PRO_OPERATION_LABELS[operationId] ?? 'Pro operation';
}

/**
 * @param {number} cost
 * @param {number} balance
 */
export function formatCreditQuoteMessage(cost, balance) {
  const creditWord = cost === 1 ? 'AI Credit' : 'AI Credits';
  return `This operation will consume ${cost} ${creditWord}. You have ${balance} remaining.`;
}
