import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from '@cantoo/pdf-lib';
import { courierSlab, cropPdfTo4x6Labels, THERMAL_HEIGHT, THERMAL_WIDTH } from '../functions/_lib/sellerTools.mjs';
import { buildHealthReport } from '../functions/api/health.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;

function assert(condition, label) {
  if (!condition) {
    failed += 1;
    console.error(`FAIL ${label}`);
    return;
  }
  console.log(`ok ${label}`);
}

const slab = courierSlab(25, 20, 12, 450);
assert(slab.volumetricGrams === 1200, `25×20×12 cm is 1,200 g volumetric, got ${slab.volumetricGrams}`);
assert(slab.slabJump === true && slab.slabLabel === '1000g+', '450 g dead weight jumps to the 1,000 g+ slab');

const source = await PDFDocument.create();
source.addPage([595, 842]);
const cropped = await cropPdfTo4x6Labels(await source.save());
const labels = await PDFDocument.load(cropped);
const size = labels.getPage(0).getSize();
assert(labels.getPageCount() === 1 && size.width === THERMAL_WIDTH && size.height === THERMAL_HEIGHT, 'label cropper emits a 4×6 inch page');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'apps/hub/public/manifest.json'), 'utf8'));
const accept = manifest.share_target?.params?.files?.[0]?.accept || [];
assert(
  manifest.share_target?.method === 'POST' &&
    accept.some((type) => String(type).includes('pdf')) &&
    accept.some((type) => String(type).includes('csv')) &&
    accept.some((type) => String(type).includes('xlsx')),
  'the PWA share target accepts pdf, csv, and xlsx',
);

const pages = {
  'about/index.html': 'November 2026',
  'pricing/index.html': '₹299',
  'contact/index.html': 'Grievance cum Nodal Officer',
  'workspace/legal/privacy/index.html': 'Neon PostgreSQL',
  'workspace/legal/terms/index.html': 'Independent',
  'workspace/legal/refund/index.html': '14-day rejected claim',
};
for (const [page, marker] of Object.entries(pages)) {
  const html = fs.readFileSync(path.join(root, 'apps/hub/dist', page), 'utf8');
  assert(html.includes(marker), `${page} contains ${marker}`);
  assert(!html.includes('Cloudflare D1 database'), `${page} does not claim a Cloudflare D1 database`);
}
const privacy = fs.readFileSync(path.join(root, 'apps/hub/dist/workspace/legal/privacy/index.html'), 'utf8');
assert(privacy.includes('November 2026') && privacy.includes('DPDP') && privacy.includes('Customer Name'), 'privacy names November 2026, DPDP, and Customer Name');
const refund = fs.readFileSync(path.join(root, 'apps/hub/dist/workspace/legal/refund/index.html'), 'utf8');
assert(refund.includes('5–7 business days') || refund.includes('5-7 business days'), 'refund names the Razorpay window');

const live = buildHealthReport({
  DATABASE_URL: 'postgres://example',
  RAZORPAY_KEY_ID: 'rzp_live_do_not_print',
  RAZORPAY_KEY_SECRET: 'super-secret',
  GEMINI_API_KEY: 'g',
  SARVAM_API_KEY: '',
  AZURE_DOC_INTEL_KEY: 'a',
});
const testMode = buildHealthReport({ RAZORPAY_KEY_ID: 'rzp_test_example' });
const blank = buildHealthReport({});
const packed = JSON.stringify(live);
assert(live.status === 'ok' && live.version === '2.0.0-cloudflare-native', 'health status and version');
assert(live.databaseConfigured === true && live.razorpayMode === 'LIVE', 'live key is reported as LIVE');
assert(testMode.razorpayMode === 'TEST' && blank.razorpayMode === 'UNCONFIGURED', 'test and missing keys stay distinct');
assert(live.aiProvidersConfigured.gemini === true && live.aiProvidersConfigured.sarvam === false && live.aiProvidersConfigured.azureDocIntel === true, 'provider flags match the keys that are set');
assert(!packed.includes('do_not_print') && !packed.includes('super-secret'), 'health JSON does not leak secrets');

if (failed) {
  console.error(`${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('phase 7 and 8 final checks passed');
