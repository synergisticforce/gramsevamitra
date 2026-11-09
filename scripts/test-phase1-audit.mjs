import { applyBps, formatMinorUnits, toMinorUnits, unlockSplit } from '../functions/_lib/currency.mjs';

let failed = 0;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    failed += 1;
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    return;
  }
  console.log(`ok ${label}`);
}

assertEqual(toMinorUnits('₹1,234.56'), 123456, 'rupee grouped');
assertEqual(toMinorUnits('(12.50)'), -1250, 'accounting parentheses');
assertEqual(toMinorUnits('$99.99'), 9999, 'dollar');
assertEqual(toMinorUnits('315.08'), 31508, 'plain decimal');
assertEqual(toMinorUnits(315), 31500, 'whole rupees');
assertEqual(toMinorUnits(null), 0, 'null');
assertEqual(formatMinorUnits(19758, '₹', 100, true), '₹१९७.५८', 'devanagari');
assertEqual(applyBps(30820, 1000), 3082, 'ten percent half-up');

const zomatoGross = toMinorUnits('₹315.00');
const zomatoCommission = 9951;
const zomatoGst = applyBps(zomatoCommission, 1800);
const zomatoNet = zomatoGross - zomatoCommission - zomatoGst;
assertEqual(zomatoGross, 31500, 'zomato gross');
assertEqual(zomatoNet, 19758, 'zomato net');
assertEqual(zomatoNet, toMinorUnits('197.58'), 'zomato net text');

const swiggyGross = toMinorUnits('₹42.00');
const swiggyCommission = 1200;
const swiggyGst = applyBps(swiggyCommission, 1800);
const swiggyOther = 12;
const swiggyNet = swiggyGross - swiggyCommission - swiggyGst - swiggyOther;
assertEqual(swiggyGross, 4200, 'swiggy gross');
assertEqual(swiggyNet, 2772, 'swiggy net');

const flipkartGross = toMinorUnits('₹2,000.00');
const flipkartShort = toMinorUnits('308.20');
const flipkartSplit = unlockSplit(flipkartShort);
assertEqual(flipkartGross, 200000, 'flipkart gross');
assertEqual(flipkartShort, 30820, 'flipkart short payment');
assertEqual(flipkartSplit.userShareMinor, 27738, 'flipkart green pocket');
assertEqual(flipkartSplit.feeMinor, 3082, 'flipkart blue pocket');
assertEqual(formatMinorUnits(flipkartShort), '₹308.20', 'flipkart total text');
assertEqual(formatMinorUnits(flipkartSplit.userShareMinor), '₹277.38', 'flipkart user text');
assertEqual(formatMinorUnits(flipkartSplit.feeMinor), '₹30.82', 'flipkart fee text');

if (failed > 0) {
  console.error(`${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('phase 1 audit checks passed');
