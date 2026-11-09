import { formatMinorUnits } from './currency.mjs';

/**
 * @param {number} paise
 */
function rupees(paise) {
  return formatMinorUnits(paise);
}

/**
 * Ready-to-copy partner dispute text. Amounts are formatted from integer paise.
 * @param {Record<string, unknown>} finding
 * @param {{ platform?: string, payoutCycleStart?: string, payoutCycleEnd?: string }} statementMeta
 */
export function generateClaimTicket(finding, statementMeta = {}) {
  const platform = String(statementMeta.platform || finding.platform || 'Platform');
  const cycleStart = String(statementMeta.payoutCycleStart || '—');
  const cycleEnd = String(statementMeta.payoutCycleEnd || '—');
  const orderId = String(finding.orderId || '—');
  const orderItemId = finding.orderItemId ? String(finding.orderItemId) : '';
  const sku = finding.sku ? String(finding.sku) : '';
  const tab = String(finding.sourceTabName || '—');
  const row = Number(finding.sourceRowNumber || 0);
  const column = String(finding.columnName || 'Amount');
  const expected = rupees(Number(finding.expectedPaise || 0));
  const billed = rupees(Number(finding.billedPaise || 0));
  const variance = rupees(Number(finding.recoverableVariancePaise || 0));
  const itemLine = [orderItemId && `Item ID: ${orderItemId}`, sku && `SKU: ${sku}`].filter(Boolean).join(', ');
  const itemLineHi = [orderItemId && `आइटम आईडी: ${orderItemId}`, sku && `SKU: ${sku}`].filter(Boolean).join(', ');

  const claimTicketEn = [
    `Hello ${platform} support,`,
    `Payout cycle: ${cycleStart} to ${cycleEnd}.`,
    `Order ID: ${orderId}${itemLine ? ` (${itemLine})` : ''}.`,
    `Sheet: ${tab}, row ${row}, column "${column}".`,
    `Expected amount: ${expected}.`,
    `Billed amount: ${billed}.`,
    `Recoverable variance: ${variance}.`,
    `Please reverse this deduction and confirm the credit on the next payout.`,
  ].join('\n');

  const claimTicketHi = [
    `नमस्ते ${platform} सपोर्ट,`,
    `भुगतान अवधि: ${cycleStart} से ${cycleEnd}.`,
    `ऑर्डर आईडी: ${orderId}${itemLineHi ? ` (${itemLineHi})` : ''}.`,
    `शीट: ${tab}, पंक्ति ${row}, कॉलम "${column}".`,
    `अपेक्षित राशि: ${expected}.`,
    `काटी गई राशि: ${billed}.`,
    `वापस मिलने वाली राशि: ${variance}.`,
    `कृपया यह कटौती वापस करें और अगले भुगतान में जमा की पुष्टि करें।`,
  ].join('\n');

  return { claimTicketEn, claimTicketHi };
}
