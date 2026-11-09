import { bouncerKeywordGate, sampleText, sheetToAoa, toWorkbook } from './baseAdapter.mjs';
import { isSwiggyWorkbook, parseSwiggyWorkbook } from './swiggyAdapter.mjs';
import { isZomatoWorkbook, parseZomatoWorkbook } from './zomatoAdapter.mjs';
import {
  isFlipkartWorkbook,
  parseAmazonMtrWorkbook,
  parseFlipkartStlWorkbook,
  parseMeeshoWorkbook,
  parseShopifyCodWorkbook,
} from './ecommerceAdapters.mjs';
import { runRestaurantAudit } from '../restaurantAuditor.mjs';
import { runEcommerceAudit } from '../ecommerceAuditor.mjs';
import { buildTaxAutopilotPackage } from '../taxAutopilot.mjs';

/**
 * @param {unknown} input
 * @param {string} [filename]
 */
export async function detectAndParseWorkbook(input, filename = '') {
  const workbook = toWorkbook(input, filename);
  const firstSheet = workbook.SheetNames[0] || '';
  const sample = sampleText(sheetToAoa(workbook, firstSheet));
  if (!bouncerKeywordGate(workbook.SheetNames, `${filename} ${sample}`)) {
    const error = new Error('This file is not a settlement workbook.');
    error.code = 'BOUNCER';
    throw error;
  }
  const names = workbook.SheetNames.join(' ').toLowerCase();
  if (isZomatoWorkbook(workbook)) return parseZomatoWorkbook(workbook);
  if (isSwiggyWorkbook(workbook)) return parseSwiggyWorkbook(workbook);
  if (names.includes('meesho')) return parseMeeshoWorkbook(workbook);
  if (names.includes('amazon') || names.includes('mtr')) return parseAmazonMtrWorkbook(workbook);
  if (names.includes('shopify') || names.includes('shiprocket')) return parseShopifyCodWorkbook(workbook);
  if (isFlipkartWorkbook(workbook)) return parseFlipkartStlWorkbook(workbook);
  const error = new Error('This file is not a settlement workbook.');
  error.code = 'BOUNCER';
  throw error;
}

/**
 * @param {unknown} input
 * @param {string} filename
 * @param {Record<string, unknown>} [contractOverrides]
 * @param {Record<string, unknown>} [options]
 */
export async function auditUploadedWorkbook(input, filename, contractOverrides = {}, options = {}) {
  const statement = await detectAndParseWorkbook(input, filename);
  const contract = {
    commissionBps: null,
    approvedDiscountShareBps: 10000,
    approvedWeeklyAdCapPaise: 100000000,
    longDistanceOptedIn: false,
    pocketHeroOptedIn: false,
    categoryCommissionBps: null,
    skuWeightMapGrams: {},
    ...contractOverrides,
  };
  const auditResult = statement.vertical === 'RESTAURANT'
    ? runRestaurantAudit(statement, contract, options)
    : runEcommerceAudit(statement, contract, options);
  const taxPackage = buildTaxAutopilotPackage(statement, auditResult);
  return { statement, auditResult, taxPackage };
}
