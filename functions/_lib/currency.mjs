/**
 * Integer minor-unit money. Rupees and dollars are converted by splitting the
 * decimal text, never by multiplying a binary float.
 */

/**
 * @param {unknown} value
 * @param {number} [scale]
 * @returns {number}
 */
export function toMinorUnits(value, scale = 100) {
  if (!Number.isInteger(scale) || scale < 1) {
    throw new Error('scale must be a positive integer');
  }
  if (value == null) return 0;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 0;
    return toMinorUnits(String(value), scale);
  }
  if (typeof value !== 'string') return 0;

  let raw = value.trim();
  if (!raw) return 0;

  let negative = false;
  raw = raw.replace(/₹|\$|€|£|₦/g, '').replace(/rs\.?/gi, '').replace(/,/g, '').replace(/\s+/g, '');
  if (raw.startsWith('(') && raw.endsWith(')')) {
    negative = true;
    raw = raw.slice(1, -1);
  }
  if (raw.startsWith('+')) raw = raw.slice(1);
  if (raw.startsWith('-')) {
    negative = true;
    raw = raw.slice(1);
  }
  if (!/^\d+(\.\d+)?$/.test(raw)) return 0;

  const [wholeText, fractionText = ''] = raw.split('.');
  const digits = decimalDigits(scale);
  const kept = fractionText.slice(0, digits).padEnd(digits, '0');
  const roundDigit = fractionText.charAt(digits);
  let whole = Number(wholeText);
  let fraction = digits === 0 ? 0 : Number(kept);
  if (roundDigit >= '5') {
    fraction += 1;
    if (fraction >= scale) {
      fraction = 0;
      whole += 1;
    }
  }

  const amount = whole * scale + fraction;
  return negative ? -amount : amount;
}

/**
 * @param {number} amountMinor
 * @param {string} [symbol]
 * @param {number} [scale]
 * @param {boolean} [useIndicDigits]
 * @returns {string}
 */
export function formatMinorUnits(amountMinor, symbol = '₹', scale = 100, useIndicDigits = false) {
  const negative = amountMinor < 0;
  const abs = Math.abs(Math.trunc(amountMinor));
  const digits = decimalDigits(scale);
  const whole = Math.floor(abs / scale);
  const fraction = String(abs % scale).padStart(digits, '0');
  const body = digits === 0 ? String(whole) : `${whole}.${fraction}`;
  const rendered = useIndicDigits ? toDevanagariDigits(body) : body;
  return `${negative ? '-' : ''}${symbol}${rendered}`;
}

/**
 * Half-up basis points. 1000 bps is 10.00%. 1800 bps is 18.00%.
 * @param {number} amountMinor
 * @param {number} bps
 * @returns {number}
 */
export function applyBps(amountMinor, bps) {
  return Math.floor((amountMinor * bps + 5000) / 10000);
}

/**
 * 10% unlock fee and the remaining 90% user share, both in minor units.
 * @param {number} recoverableMinor
 */
export function unlockSplit(recoverableMinor) {
  const feeMinor = applyBps(recoverableMinor, 1000);
  return {
    recoverableMinor,
    userShareMinor: recoverableMinor - feeMinor,
    feeMinor,
  };
}

/**
 * @param {number} scale
 */
function decimalDigits(scale) {
  let digits = 0;
  let rest = scale;
  while (rest > 1 && rest % 10 === 0) {
    digits += 1;
    rest = Math.floor(rest / 10);
  }
  if (rest !== 1) {
    throw new Error('scale must be a power of 10');
  }
  return digits;
}

const DEVANAGARI = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];

/**
 * @param {string} value
 */
function toDevanagariDigits(value) {
  return value.replace(/[0-9]/g, (digit) => DEVANAGARI[Number(digit)]);
}
