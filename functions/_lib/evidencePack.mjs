import { formatMinorUnits } from './currency.mjs';
import * as XLSX from 'xlsx';

const SUMMARY_SHEET = 'Executive Summary & UTR Bridge';
const PROOF_SHEET = 'Line-by-Line Dispute Proof';
const HELD_SHEET = 'Held Orders Checklist';
const TAX_SHEET = 'Tax Autopilot & Tally';

/**
 * @param {unknown} value
 */
function n(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 0;
}

/**
 * @param {unknown} paise
 */
function rupees(paise) {
  return formatMinorUnits(n(paise));
}

/**
 * @param {Record<string, unknown>} finding
 */
function leakageBucket(finding) {
  const type = String(finding.findingType || '');
  const bucket = String(finding.deductionBucket || '');
  if (bucket === 'HELD_ORDER' || type.includes('HELD')) return 'held';
  if (bucket === 'LOGISTICS_OVERCHARGE' || /SHIP|WEIGHT|RTO/.test(type)) return 'logistics';
  if (/AD_SPEND|ADS/.test(type)) return 'ads';
  if (bucket === 'STATUTORY_TAX' || /SECTION_95|TDS|TCS/.test(type)) return 'statutory';
  if (/COMMISSION|EXCESS_GST/.test(type) || bucket === 'CONTRACT_FEE') return 'commission';
  return 'complaint';
}

/**
 * @param {Record<string, unknown>} statement
 */
function utrBridge(statement) {
  const orders = Array.isArray(statement?.orders) ? statement.orders : [];
  const items = Array.isArray(statement?.items) ? statement.items : [];
  const adjustments = Array.isArray(statement?.outletAdjustments) ? statement.outletAdjustments : [];
  const orderPayouts = orders.reduce((sum, order) => sum + n(order.declaredOrderPayoutPaise), 0)
    + items.reduce((sum, item) => sum + n(item.declaredSettledPaise), 0);
  let additions = 0;
  let deductions = 0;
  for (const adjustment of adjustments) {
    const settled = n(adjustment.settledThisCyclePaise);
    if (String(adjustment.kind || '').toUpperCase() === 'ADDITION') additions += settled;
    else deductions += settled;
  }
  const computed = orderPayouts + additions - deductions;
  const declared = n(
    statement?.declaredBankUtrPaise ?? statement?.declaredSummaryNetPayoutPaise ?? statement?.declaredNetPayoutPaise,
  );
  return { orderPayouts, additions, deductions, computed, declared, matches: computed === declared };
}

/**
 * @param {Record<string, unknown>} statement
 * @param {Record<string, unknown>} auditResult
 * @param {Record<string, unknown>} [taxPackage]
 */
export function buildEvidencePackWorkbook(statement, auditResult, taxPackage = {}) {
  const findings = Array.isArray(auditResult?.findings) ? auditResult.findings : [];
  const buckets = { commission: 0, logistics: 0, ads: 0, complaint: 0, held: 0, statutory: 0 };
  for (const finding of findings) buckets[leakageBucket(finding)] += n(finding.recoverableVariancePaise);
  const bridge = utrBridge(statement || {});
  const total = Number.isFinite(auditResult?.totalRecoverablePaise)
    ? n(auditResult.totalRecoverablePaise)
    : findings.reduce((sum, finding) => sum + n(finding.recoverableVariancePaise), 0);

  const summaryRows = [
    ['Platform', String(statement?.platform || '')],
    ['Outlet or store', String(statement?.outletName || statement?.storeName || statement?.restaurantName || '')],
    ['Payout cycle start', String(statement?.payoutCycleStart || '')],
    ['Payout cycle end', String(statement?.payoutCycleEnd || '')],
    ['Total Recoverable Leakage', rupees(total)],
    [],
    ['Leakage bucket', 'Amount'],
    ['Commission Overcharges', rupees(buckets.commission)],
    ['Logistics/Weight Overcharges', rupees(buckets.logistics)],
    ['Unconsented Ads/Deductions', rupees(buckets.ads)],
    ['Complaint/Cancellation Cuts', rupees(buckets.complaint)],
    ['Held Orders to Resolve in App', rupees(buckets.held)],
    ['Statutory Tax Pass-Throughs', rupees(n(taxPackage.section95PassThroughGstPaise) + n(taxPackage.form26asTds194OPaise) + n(taxPackage.gstr8TcsSec52Paise))],
    [],
    ['Cross-Tab Bank UTR / NEFT'],
    ['Sum of Order Payouts', rupees(bridge.orderPayouts)],
    ['Settled Additions', rupees(bridge.additions)],
    ['Settled Deductions', rupees(bridge.deductions)],
    ['Sum of Order Payouts + Settled Additions - Settled Deductions', rupees(bridge.computed)],
    ['Declared Bank UTR', rupees(bridge.declared)],
    ['Bridge matches', bridge.matches ? 'YES' : 'NO'],
  ];

  const proofRows = [[
    'Order ID',
    'Order Item ID',
    'SKU',
    'Source Tab',
    'Source Excel Row #',
    'Issue Type',
    'Expected (₹)',
    'Billed (₹)',
    'Recoverable Variance (₹)',
    'English Support Ticket',
    'Hindi Support Ticket',
  ]];
  for (const finding of findings) {
    proofRows.push([
      String(finding.orderId || ''),
      String(finding.orderItemId || ''),
      String(finding.sku || ''),
      String(finding.sourceTabName || ''),
      n(finding.sourceRowNumber),
      String(finding.findingType || ''),
      rupees(finding.expectedPaise),
      rupees(finding.billedPaise),
      rupees(finding.recoverableVariancePaise),
      String(finding.claimTicketEn || ''),
      String(finding.claimTicketHi || ''),
    ]);
  }

  const heldRows = [[
    'Order ID',
    'Amount',
    'Reason',
    'What to do in the Partner App',
  ]];
  const held = Array.isArray(statement?.heldOrders) ? statement.heldOrders : [];
  if (!held.length) {
    heldRows.push(['', '', 'No held orders on this statement.', '']);
  }
  for (const order of held) {
    const platform = String(statement?.platform || 'the partner');
    heldRows.push([
      String(order.orderId || ''),
      rupees(order.amountPaise),
      String(order.reason || 'Unresolved customer complaint'),
      `Open the ${platform} Partner App, find order ${order.orderId || ''}, reply before the deadline, and keep a screenshot. ${order.deadline || ''}`.trim(),
    ]);
  }

  const taxRows = [
    ['Tax line', 'Amount'],
    ['GSTR-2B 18% fee input tax credit', rupees(taxPackage.gstr2bInputTaxCredit18PctPaise)],
    ['Form 26AS Section 194-O TDS', rupees(taxPackage.form26asTds194OPaise)],
    ['GSTR-8 Section 52 TCS', rupees(taxPackage.gstr8TcsSec52Paise)],
    ['Section 9(5) 5% customer GST pass-through', rupees(taxPackage.section95PassThroughGstPaise)],
    [],
    ['Tally Prime / Zoho Books journal'],
  ];
  const journal = String(taxPackage.tallyJournalCsv || '').split('\n').filter(Boolean);
  for (const line of journal) taxRows.push(line.split(','));
  if (!journal.length) taxRows.push(['Journal', 'No journal rows on this statement.']);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), SUMMARY_SHEET);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(proofRows), PROOF_SHEET);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(heldRows), HELD_SHEET);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(taxRows), TAX_SHEET);
  const written = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return { workbook, bytes: new Uint8Array(written) };
}

export const EVIDENCE_PACK_SHEETS = [SUMMARY_SHEET, PROOF_SHEET, HELD_SHEET, TAX_SHEET];
