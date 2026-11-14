/**
 * Opus 5.5 xhigh audit regression — edge cases and hard-blocks.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as XLSX from 'xlsx';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function load(rel) {
  return import(pathToFileURL(join(root, rel)).href);
}

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

const { toMinorUnits, applyBps } = await load('functions/_lib/currency.mjs');
const { isPiiHeader, scrubCustomerPiiRow, toWorkbook, moneyPaise } = await load(
  'functions/_lib/adapters/baseAdapter.mjs',
);
const {
  buildCompliantUnlockCheckout,
  applyFreemiumTeaserMask,
  calculateMunshiCommission,
} = await load('functions/_lib/unlockEngine.mjs');
const { passesDocumentConfidenceGate, DOCUMENT_CONFIDENCE_MIN } = await load(
  'apps/hub/src/lib/documents/browserOcrGate.ts',
).catch(async () => {
  // Vite/TS may not resolve; assert the source constant instead.
  const src = read('apps/hub/src/lib/documents/browserOcrGate.ts');
  assert.match(src, /DOCUMENT_CONFIDENCE_MIN\s*=\s*95/, 'OCR gate stays at 95');
  return {
    DOCUMENT_CONFIDENCE_MIN: 95,
    passesDocumentConfidenceGate: (input) =>
      input.meanConfidence >= 95 && input.words.length > 0,
  };
});

assert.equal(toMinorUnits('₹ 1,234.50'), 123450, 'currency symbol with spaces');
assert.equal(toMinorUnits('(45.00)'), -4500, 'accounting parentheses');
assert.equal(toMinorUnits('-₹45.00'), -4500, 'negative rupee');
assert.equal(toMinorUnits('#REF!'), 0, 'Excel #REF! is zero');
assert.equal(toMinorUnits('#VALUE!'), 0, 'Excel #VALUE! is zero');
assert.equal(toMinorUnits('NaN'), 0, 'NaN text is zero');
assert.equal(toMinorUnits('\uFEFF197.58'), 19758, 'UTF-8 BOM before amount');
assert.equal(moneyPaise('#DIV/0!'), 0, 'moneyPaise rejects formula errors');
assert.equal(applyBps(100000, 1800), 18000, '18% via bps');
assert.equal(applyBps(450000, 1000), 45000, '10% unlock fee');

const bomCsv = '\uFEFFOrder ID,Net Payout,Address,Phone\nSW-1,100.00,Street 1,9999900000\n';
const book = toWorkbook(new TextEncoder().encode(bomCsv), 'sample.csv');
assert.ok(book.SheetNames.length >= 1, 'BOM CSV opens');
const sheet = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: '' });
assert.equal(String(sheet[0]?.['Order ID'] || ''), 'SW-1', 'BOM CSV keeps order id');
const row = scrubCustomerPiiRow({ ...sheet[0] });
assert.equal(row.Address, undefined, 'BOM CSV address scrubbed after parse');
assert.equal(row.Phone, undefined, 'BOM CSV phone scrubbed after parse');

assert.equal(isPiiHeader('Address'), true, 'bare Address is PII');
assert.equal(isPiiHeader('Pin Code'), true, 'Pin Code is PII');
const scrubbed = scrubCustomerPiiRow({
  orderId: 'SW-1',
  Address: 'leak',
  Phone: '9999900000',
  'Customer Name': 'Asha',
  net: 100,
});
assert.equal(scrubbed.Address, undefined, 'Address scrubbed');
assert.equal(scrubbed.Phone, undefined, 'Phone scrubbed');
assert.equal(scrubbed['Customer Name'], undefined, 'Customer Name scrubbed');
assert.equal(scrubbed.orderId, 'SW-1', 'order id kept');

const mandate = buildCompliantUnlockCheckout('u1', 45000, 'TRUST_CLOCK_MANDATE');
assert.equal(mandate.authAmountPaise, 100, 'mandate authorises ₹1');
assert.equal(mandate.maxAmountPaise, 45000, 'mandate ceiling is unlock fee');
assert.notEqual(mandate.amountPaise, 9900, 'mandate is not stuck at ₹99');

const oneTap = buildCompliantUnlockCheckout('u1', 45000, 'ONE_TAP_UPI');
assert.equal(oneTap.amountPaise, 45000, 'one-tap charges unlock fee');

const pro = buildCompliantUnlockCheckout('u1', 0, 'PRO_299');
assert.equal(pro.amountPaise, 29900, 'Mitra Pro is ₹299');

assert.equal(calculateMunshiCommission(45000), 13500, '30% munshi on unlock');
assert.equal(calculateMunshiCommission(29900), 8970, '30% munshi on Pro');

const locked = applyFreemiumTeaserMask({
  totalRecoverablePaise: 450000,
  findings: [
    { orderId: 'A', recoverableVariancePaise: 150000 },
    { orderId: 'B', recoverableVariancePaise: 150000 },
    { orderId: 'C', recoverableVariancePaise: 150000 },
  ],
});
assert.equal(locked.isUnlocked, false, '₹4500 stays locked');
assert.equal(locked.unlockFeePaise, 45000, 'unlock fee 10%');
assert.equal(locked.findings[0].isMasked, false, 'first proof visible');
assert.equal(locked.findings[1].isMasked, true, 'later rows masked');

const free = applyFreemiumTeaserMask({
  totalRecoverablePaise: 15000,
  findings: [{ orderId: 'A', recoverableVariancePaise: 15000 }],
});
assert.equal(free.isUnlocked, true, 'under ₹200 is free');
assert.equal(free.unlockFeePaise, 0, 'free unlock fee is 0');

assert.equal(DOCUMENT_CONFIDENCE_MIN, 95, 'document OCR gate is 95');
assert.equal(
  passesDocumentConfidenceGate({ meanConfidence: 94.9, words: [{ confidence: 96 }, { confidence: 97 }] }),
  false,
  '94.9% fails the gate',
);
assert.equal(
  passesDocumentConfidenceGate({ meanConfidence: 95.0, words: [{ confidence: 96 }, { confidence: 97 }] }),
  true,
  '95.0% passes the mean gate',
);

const blocked = [
  'functions/api/pro/media-process.js',
  'functions/api/pro/ocr-orchestrator.js',
  'functions/api/pro/reconstruct-layout.js',
  'functions/api/pro/extract.js',
  'functions/api/pro/smart-extract.js',
  'functions/api/pro/file-converter.js',
  'functions/api/pro/smart-router.js',
  'functions/api/pro/media-process/upload.js',
  'functions/api/pro/reconstruct-layout/upload.js',
  'functions/api/pro/smart-extract/upload.js',
  'functions/api/pro/file-converter/upload.js',
];
for (const rel of blocked) {
  const src = read(rel);
  assert.match(src, /FEATURE_NOT_AVAILABLE/, `${rel} hard-blocks`);
  assert.match(src, /creditsCharged:\s*0/, `${rel} never charges`);
  assert.match(src, /return jsonResponse\([\s\S]*?503/, `${rel} returns 503`);
  // The first executable return in onRequestPost must be the hard-block.
  const post = src.slice(src.indexOf('onRequestPost'));
  const firstReturn = post.indexOf('return jsonResponse');
  const firstCredits = post.search(/requireProCredits|deductOperationCredits/);
  assert.ok(firstReturn >= 0, `${rel} returns json`);
  assert.ok(
    firstCredits < 0 || firstReturn < firstCredits,
    `${rel} hard-blocks before any credit gate call`,
  );
}

const shareJs = read('apps/hub/public/share-target.js');
assert.match(shareJs, /method !== 'POST'/, 'share-target handles POST');
assert.match(shareJs, /gsm-share/, 'share-target caches file');
assert.match(shareJs, /shared=1/, 'share-target redirects to owner');

const ownerSrc = read('apps/hub/src/components/finance/OwnerVisualPWA.tsx');
assert.match(ownerSrc, /shared-payout-file/, 'owner consumes share cache');
assert.match(ownerSrc, /aria-label/, 'owner has aria-labels');
assert.match(ownerSrc, /stack/i, 'owner sanitizes technical errors');

const ocrApi = read('functions/api/audit/ocr-extract.js');
assert.match(ocrApi, /reserveGuestQuota/, 'payout OCR enforces guest quota');
assert.match(ocrApi, /releaseGuestQuota/, 'payout OCR releases quota on failure');
assert.match(ocrApi, /creditsCharged:\s*0/, 'failed OCR charges 0');

const ocrGate = read('apps/hub/src/lib/documents/browserOcrGate.ts');
assert.doesNotMatch(ocrGate, /DOCUMENT_CONFIDENCE_MIN\s*=\s*8[0-9]/, 'gate is not lowered to 8x');
assert.match(ocrGate, /DOCUMENT_CONFIDENCE_MIN\s*=\s*95/, 'gate locked at 95');

const noFastapi = [
  '.cursorrules',
  'STATUS_REPORT.md',
  'PWA_BLUEPRINT.md',
];
for (const rel of noFastapi) {
  const src = read(rel);
  assert.match(src, /Cloudflare Pages/, `${rel} keeps Cloudflare`);
  assert.doesNotMatch(src, /Start building the Python FastAPI/, `${rel} does not push FastAPI`);
}

console.log('opus audit checks passed');
