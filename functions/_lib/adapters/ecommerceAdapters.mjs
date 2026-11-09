import {
  findHeaderRowIndex,
  findSheetName,
  isSummaryOrTotalRow,
  moneyPaise,
  rowObject,
  sheetToAoa,
  wholeNumber,
} from './baseAdapter.mjs';

const FLIPKART_ALIASES = {
  orderId: ['order id'],
  orderItemId: ['order item id'],
  sku: ['sku'],
  orderStatus: ['order status'],
  transactionType: ['transaction type'],
  grossSalePaise: ['sale value', 'selling price', 'principal'],
  marketplaceCommissionPaise: ['commission'],
  fixedOrClosingFeePaise: ['fixed fee', 'closing fee'],
  collectionFeePaise: ['collection fee'],
  forwardShippingFeePaise: ['forward shipping'],
  reverseShippingFeePaise: ['reverse shipping'],
  tcsSec52Paise: ['tcs'],
  tds194OPaise: ['tds 194-o', 'tds 194o', 'tds'],
  gstOnFees18PctPaise: ['gst on fees', 'gst'],
  billedWeightGrams: ['billed weight'],
  shippingZone: ['shipping zone'],
  declaredSettledPaise: ['settled amount', 'settled'],
  neftOrUtrId: ['neft id', 'neft'],
};

/**
 * @param {import('xlsx').WorkBook} workbook
 */
export function isFlipkartWorkbook(workbook) {
  const names = workbook.SheetNames.map((name) => name.toLowerCase());
  const hasOrders = names.some((name) => name === 'orders' || name.includes('flipkart'));
  const hasSide = names.some((name) => /ads|pla|spf|storage|tds/.test(name));
  return names.some((name) => name.includes('flipkart')) || (hasOrders && hasSide);
}

/**
 * @param {import('xlsx').WorkBook} workbook
 */
export function parseFlipkartStlWorkbook(workbook) {
  const items = parseItemSheet(workbook, findSheetName(workbook, /^orders$/), 'Orders', FLIPKART_ALIASES);
  const ads = parseAmountSheet(workbook, findSheetName(workbook, /ads|pla/), 'Ads', 'DEDUCTION', 'ADS');
  const spf = parseAmountSheet(workbook, findSheetName(workbook, /^spf$/), 'SPF', 'ADDITION', 'OTHER');
  const storage = parseAmountSheet(workbook, findSheetName(workbook, /storage/), 'Storage and Recall', 'DEDUCTION', 'OTHER');
  const summaryName = findSheetName(workbook, /summary|neft/);
  const summary = readNet(sheetToAoa(workbook, summaryName));
  const outletAdjustments = [...ads, ...spf, ...storage];
  const settled = items.reduce((sum, item) => sum + item.declaredSettledPaise, 0);
  const adjustmentSum = outletAdjustments.reduce(
    (sum, row) => sum + (row.kind === 'ADDITION' ? row.settledThisCyclePaise : -row.settledThisCyclePaise),
    0,
  );
  return baseStatement('FLIPKART', items, outletAdjustments, summary, settled + adjustmentSum);
}

/**
 * @param {import('xlsx').WorkBook} workbook
 */
export function parseMeeshoWorkbook(workbook) {
  const sheet = findSheetName(workbook, /meesho|order|payout/) || workbook.SheetNames[0];
  const items = parseItemSheet(workbook, sheet, sheet, {
    orderId: ['sub order no', 'order id'],
    orderItemId: ['sub order no', 'order id'],
    sku: ['sku'],
    orderStatus: ['order status'],
    grossSalePaise: ['sale value'],
    marketplaceCommissionPaise: ['meesho commission', 'commission'],
    forwardShippingFeePaise: ['forward shipping'],
    reverseShippingFeePaise: ['return shipping'],
    tcsSec52Paise: ['tcs'],
    tds194OPaise: ['tds'],
    billedWeightGrams: ['billed weight grams', 'weight slab', 'billed weight'],
    declaredSettledPaise: ['settled amount', 'net settlement', 'payout'],
  });
  const settled = items.reduce((sum, item) => sum + item.declaredSettledPaise, 0);
  return baseStatement('MEESHO', items, [], { net: null, utr: '' }, settled);
}

/**
 * @param {import('xlsx').WorkBook} workbook
 */
export function parseAmazonMtrWorkbook(workbook) {
  const sheet = findSheetName(workbook, /mtr|settlement/) || workbook.SheetNames[0];
  const items = parseItemSheet(workbook, sheet, sheet, {
    orderId: ['order id'],
    orderItemId: ['order item id', 'order id'],
    sku: ['sku'],
    transactionType: ['transaction type'],
    grossSalePaise: ['principal', 'sale value'],
    marketplaceCommissionPaise: ['referral fee'],
    fixedOrClosingFeePaise: ['closing fee'],
    forwardShippingFeePaise: ['weight handling fee', 'fba weight', 'easy ship'],
    tcsSec52Paise: ['tcs'],
    tds194OPaise: ['tds 194-o', 'tds'],
    declaredSettledPaise: ['net settlement', 'settled amount'],
  });
  const settled = items.reduce((sum, item) => sum + item.declaredSettledPaise, 0);
  return baseStatement('AMAZON', items, [], { net: null, utr: '' }, settled);
}

/**
 * @param {import('xlsx').WorkBook} workbook
 */
export function parseShopifyCodWorkbook(workbook) {
  const sheet = findSheetName(workbook, /shopify|shiprocket|cod/) || workbook.SheetNames[0];
  const items = parseItemSheet(workbook, sheet, sheet, {
    orderId: ['order id'],
    orderItemId: ['awb', 'order id'],
    sku: ['sku'],
    orderStatus: ['status'],
    grossSalePaise: ['cod collectible', 'collectible'],
    declaredWeightGrams: ['declared weight'],
    billedWeightGrams: ['billed weight'],
    forwardShippingFeePaise: ['forward freight'],
    reverseShippingFeePaise: ['rto freight'],
    declaredSettledPaise: ['courier remitted', 'remitted'],
  });
  const settled = items.reduce((sum, item) => sum + item.declaredSettledPaise, 0);
  return baseStatement('SHOPIFY_COD', items, [], { net: null, utr: '' }, settled);
}

/**
 * @param {string} platform
 * @param {Array<Record<string, unknown>>} items
 * @param {Array<Record<string, unknown>>} outletAdjustments
 * @param {{ net: number | null, utr: string }} summary
 * @param {number} fallbackNet
 */
function baseStatement(platform, items, outletAdjustments, summary, fallbackNet) {
  return {
    platform,
    vertical: 'ECOMMERCE',
    currencyCode: 'INR',
    minorUnitScale: 100,
    payoutCycleStart: '',
    payoutCycleEnd: '',
    bankUtr: summary.utr,
    declaredSummaryNetPayoutPaise: summary.net == null ? fallbackNet : summary.net,
    orders: [],
    items,
    outletAdjustments,
    heldOrders: [],
    warnings: [],
  };
}

/**
 * @param {import('xlsx').WorkBook} workbook
 * @param {string} sheetName
 * @param {string} sourceTabName
 * @param {Record<string, string[]>} aliases
 */
function parseItemSheet(workbook, sheetName, sourceTabName, aliases) {
  if (!sheetName) return [];
  const aoa = sheetToAoa(workbook, sheetName);
  const header = findHeaderRowIndex(aoa, aliases);
  if (!header) return [];
  /** @type {Array<Record<string, unknown>>} */
  const items = [];
  for (let index = header.headerRowIndex + 1; index < aoa.length; index += 1) {
    const raw = rowObject(aoa, header.columns, index);
    const primary = raw.orderItemId || raw.orderId;
    if (isSummaryOrTotalRow({ ...raw, orderId: primary }, ['orderId'])) continue;
    const gross = moneyPaise(raw.grossSalePaise);
    const commission = moneyPaise(raw.marketplaceCommissionPaise);
    const fixed = moneyPaise(raw.fixedOrClosingFeePaise);
    const collection = moneyPaise(raw.collectionFeePaise);
    const forward = moneyPaise(raw.forwardShippingFeePaise);
    const reverse = moneyPaise(raw.reverseShippingFeePaise);
    const gst = moneyPaise(raw.gstOnFees18PctPaise);
    const tcs = moneyPaise(raw.tcsSec52Paise);
    const tds = moneyPaise(raw.tds194OPaise);
    const computedSettled = gross - commission - fixed - collection - forward - reverse - gst - tcs - tds;
    const declared = raw.declaredSettledPaise === '' || raw.declaredSettledPaise == null
      ? computedSettled
      : moneyPaise(raw.declaredSettledPaise);
    items.push({
      orderId: String(raw.orderId || primary),
      orderItemId: String(raw.orderItemId || primary),
      sku: String(raw.sku || ''),
      transactionType: mapTransaction(raw.transactionType),
      orderStatus: mapStatus(raw.orderStatus),
      grossSalePaise: gross,
      marketplaceCommissionPaise: commission,
      fixedOrClosingFeePaise: fixed,
      collectionFeePaise: collection,
      forwardShippingFeePaise: forward,
      reverseShippingFeePaise: reverse,
      gstOnFees18PctPaise: gst,
      tcsSec52Paise: tcs,
      tds194OPaise: tds,
      spfOrReimbursementPaise: 0,
      otherDeductionPaise: 0,
      declaredSettledPaise: declared,
      billedWeightGrams: wholeNumber(raw.billedWeightGrams),
      declaredWeightGrams: wholeNumber(raw.declaredWeightGrams),
      shippingZone: String(raw.shippingZone || ''),
      neftOrUtrId: String(raw.neftOrUtrId || ''),
      sourceTabName,
      sourceRowNumber: index + 1,
      rawRowJson: JSON.stringify(raw),
    });
  }
  return items;
}

/**
 * @param {import('xlsx').WorkBook} workbook
 * @param {string} sheetName
 * @param {string} sourceTabName
 * @param {'ADDITION' | 'DEDUCTION'} kind
 * @param {string} category
 */
function parseAmountSheet(workbook, sheetName, sourceTabName, kind, category) {
  if (!sheetName) return [];
  const aoa = sheetToAoa(workbook, sheetName);
  const header = findHeaderRowIndex(aoa, {
    particulars: ['campaign', 'claim', 'description', 'particulars', 'type'],
    settled: ['settled', 'amount'],
  });
  if (!header) return [];
  /** @type {Array<Record<string, unknown>>} */
  const rows = [];
  for (let index = header.headerRowIndex + 1; index < aoa.length; index += 1) {
    const raw = rowObject(aoa, header.columns, index);
    if (isSummaryOrTotalRow({ orderId: raw.particulars }, ['orderId'])) continue;
    const settled = moneyPaise(raw.settled);
    if (!settled) continue;
    rows.push({
      kind,
      category,
      totalChargePaise: settled,
      settledThisCyclePaise: settled,
      outstandingCarryForwardPaise: 0,
      invoiceNumber: String(raw.particulars || sourceTabName),
      sourceTabName,
      sourceRowNumber: index + 1,
    });
  }
  return rows;
}

/**
 * @param {unknown[][]} aoa
 */
function readNet(aoa) {
  let utr = '';
  /** @type {number | null} */
  let net = null;
  for (const row of aoa) {
    const label = String(row?.[0] ?? '').toLowerCase();
    if ((label.includes('net payout') || label.includes('net settlement') || label.includes('neft amount')) && net == null) {
      net = moneyPaise(row[1]);
    }
    if ((label.includes('neft id') || label.includes('utr')) && !utr) utr = String(row[1] ?? '');
  }
  return { net, utr };
}

/**
 * @param {unknown} value
 */
function mapStatus(value) {
  const text = String(value ?? '').toLowerCase();
  if (text.includes('rto')) return 'RTO';
  if (text.includes('return')) return 'CUSTOMER_RETURN';
  if (text.includes('cancel')) return 'CANCELLED';
  return 'DELIVERED';
}

/**
 * @param {unknown} value
 */
function mapTransaction(value) {
  const text = String(value ?? '').toLowerCase();
  if (text.includes('return')) return 'RETURN';
  if (text.includes('rto')) return 'RTO';
  if (text.includes('claim')) return 'CLAIM';
  return 'SALE';
}
