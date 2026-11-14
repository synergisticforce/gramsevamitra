import { toMinorUnits } from '../currency.mjs';
import * as XLSX from 'xlsx';

const BOUNCER_KEYWORDS = [
  'swiggy',
  'zomato',
  'meesho',
  'flipkart',
  'amazon',
  'shopify',
  'shiprocket',
  'order',
  'utr',
  'neft',
  'settlement',
  'payout',
  'annexure',
  'commission',
  'gstin',
];

const PII_HEADERS = [
  'customer name',
  'buyer name',
  'customer phone',
  'phone',
  'mobile',
  'address',
  'buyer address',
  'customer address',
  'shipping address',
  'pin code',
  'pincode',
  'delivery instructions',
];

/**
 * @param {unknown} value
 */
export function normalizeHeader(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string[]} sheetNames
 * @param {string} sampleHeaderOrText
 */
export function bouncerKeywordGate(sheetNames, sampleHeaderOrText) {
  const haystack = `${sheetNames.join(' ')} ${String(sampleHeaderOrText || '').slice(0, 500)}`.toLowerCase();
  return BOUNCER_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

/**
 * @param {string} header
 */
export function isPiiHeader(header) {
  const name = normalizeHeader(header);
  return PII_HEADERS.some((pii) => name === pii || name.startsWith(`${pii} `));
}

/**
 * @param {Record<string, unknown>} rowObj
 */
export function scrubCustomerPiiRow(rowObj) {
  if (!rowObj || typeof rowObj !== 'object') return rowObj;
  for (const key of Object.keys(rowObj)) {
    if (isPiiHeader(key)) delete rowObj[key];
  }
  return rowObj;
}

/**
 * @param {Record<string, unknown>} rowObj
 * @param {string[]} primaryIdFieldNames
 */
export function isSummaryOrTotalRow(rowObj, primaryIdFieldNames) {
  const id = primaryIdFieldNames
    .map((name) => rowObj?.[name])
    .find((value) => value !== undefined);
  const idText = String(id ?? '').trim().toLowerCase();
  if (id == null || idText === '' || idText === '-' || idText === 'nan' || idText === 'undefined') {
    return true;
  }
  for (const value of Object.values(rowObj || {})) {
    const text = String(value ?? '').toUpperCase();
    if (text.includes('GRAND TOTAL') || text.includes('SUBTOTAL') || text === 'TOTAL' || text.includes('TOTAL') || text.includes('SUMMARY')) {
      return true;
    }
  }
  return false;
}

/**
 * @param {unknown[][]} aoa
 * @param {Record<string, string[]>} requiredAliases
 */
export function findHeaderRowIndex(aoa, requiredAliases) {
  const limit = Math.min(15, aoa.length);
  /** @type {{ headerRowIndex: number, columns: Record<string, number>, score: number } | null} */
  let best = null;
  for (let index = 0; index < limit; index += 1) {
    const cells = (aoa[index] || []).map((cell) => normalizeHeader(cell));
    /** @type {Record<string, number>} */
    const columns = {};
    for (const [field, aliases] of Object.entries(requiredAliases)) {
      const found = matchColumn(cells, aliases);
      if (found >= 0) columns[field] = found;
    }
    const score = Object.keys(columns).length;
    const hasAnchor = ['orderId', 'orderItemId', 'adjustmentType', 'particulars'].some((key) => columns[key] != null);
    if (score > (best?.score || 0)) best = { headerRowIndex: index, columns, score };
    if (score >= 2 && hasAnchor) return { headerRowIndex: index, columns };
  }
  if (best && best.score >= 2) return { headerRowIndex: best.headerRowIndex, columns: best.columns };
  return null;
}

/**
 * @param {string[]} cells
 * @param {string[]} aliases
 */
function matchColumn(cells, aliases) {
  const ordered = [...aliases].sort((a, b) => b.length - a.length);
  for (const alias of ordered) {
    const exact = cells.findIndex((cell) => cell === alias);
    if (exact >= 0) return exact;
  }
  for (const alias of ordered) {
    const fuzzy = cells.findIndex((cell) => cell.includes(alias));
    if (fuzzy >= 0) return fuzzy;
  }
  return -1;
}

/**
 * @param {string} text
 */
export function hasCorruptedLegacyIndicFont(text) {
  const compact = String(text || '').replace(/\s+/g, '');
  if (compact.length < 12) return false;
  let privateUse = 0;
  for (const char of compact) {
    const code = char.codePointAt(0) || 0;
    if (code >= 0xe000 && code <= 0xf8ff) privateUse += 1;
  }
  if (privateUse / compact.length > 0.15) return true;
  const words = String(text).split(/\s+/).filter((word) => word.length >= 3);
  if (words.length < 4) return false;
  const gibberish = words.filter((word) => /[A-Za-z];[A-Za-z]/.test(word)).length;
  return gibberish / words.length > 0.15;
}

/**
 * @param {unknown} value
 */
export function moneyPaise(value) {
  if (value == null || value === '') return 0;
  return toMinorUnits(value);
}

/**
 * @param {unknown} value
 */
export function wholeNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  const match = String(value ?? '').match(/-?\d+(\.\d+)?/);
  return match ? Math.round(Number(match[0])) : 0;
}

/**
 * @param {import('xlsx').WorkBook} workbook
 * @param {RegExp} pattern
 */
export function findSheetName(workbook, pattern) {
  return workbook.SheetNames.find((name) => pattern.test(name.trim().toLowerCase())) || '';
}

/**
 * @param {import('xlsx').WorkBook} workbook
 * @param {string} sheetName
 */
export function sheetToAoa(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
}

/**
 * @param {unknown[][]} aoa
 * @param {Record<string, number>} columns
 * @param {number} rowIndex
 */
export function rowObject(aoa, columns, rowIndex) {
  const source = aoa[rowIndex] || [];
  /** @type {Record<string, unknown>} */
  const row = {};
  for (const [field, index] of Object.entries(columns)) {
    row[field] = source[index];
  }
  return scrubCustomerPiiRow(row);
}

/**
 * @param {unknown} input
 * @param {string} [filename]
 */
export function toWorkbook(input, filename = '') {
  if (input && typeof input === 'object' && Array.isArray(input.SheetNames) && input.Sheets) {
    return input;
  }
  if (typeof input === 'string') {
    return XLSX.read(input, { type: 'string' });
  }
  const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  if (filename.toLowerCase().endsWith('.csv')) {
    const text = new TextDecoder().decode(bytes).replace(/^\uFEFF/, '');
    return XLSX.read(text, { type: 'string' });
  }
  return XLSX.read(bytes, { type: 'array' });
}

/**
 * @param {unknown[][]} aoa
 */
export function sampleText(aoa) {
  return aoa
    .slice(0, 15)
    .map((row) => (row || []).join(' '))
    .join(' ')
    .slice(0, 500);
}
