/**
 * UI guardrails plus a 75-PDF merge stress check.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PDFDocument } from '@cantoo/pdf-lib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (rel) => import(pathToFileURL(join(root, rel)).href);
const read = (rel) => readFileSync(join(root, rel), 'utf8');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      walk(full, out);
    } else if (/\.(tsx|ts|astro|jsx|js)$/.test(name)) out.push(full);
  }
  return out;
}

const { naturalPdfNameSort, mergePdfBytesSequentially } = await load('functions/_lib/pdfMergeBatch.mjs');
const { informalSimpleAprPercent, informalCompoundAprPercent, standardEmiPaise } = await load('functions/_lib/livelihoodMath.mjs');
const { courierSlab } = await load('functions/_lib/sellerTools.mjs');

const names = Array.from({ length: 75 }, (_, index) => `${75 - index}.pdf`);
const sorted = naturalPdfNameSort(names);
assert.deepEqual(sorted.slice(0, 3), ['1.pdf', '2.pdf', '3.pdf'], 'natural sort starts at 1.pdf');
assert.equal(sorted[9], '10.pdf', '10.pdf stays after 9.pdf');
assert.equal(sorted.at(-1), '75.pdf', '75.pdf is last');

const buffers = [];
for (const name of sorted) {
  const pdf = await PDFDocument.create();
  pdf.addPage();
  buffers.push(await pdf.save());
  void name;
}
const started = performance.now();
const mergedBytes = await mergePdfBytesSequentially(buffers, { yieldToUi: false, yieldEvery: 5 });
const elapsed = performance.now() - started;
const merged = await PDFDocument.load(mergedBytes);
assert.equal(merged.getPageCount(), 75, '75 one-page PDFs merge to 75 pages');
assert.ok(elapsed < 3000, `75-pdf merge finished in ${Math.round(elapsed)} ms`);
console.log(`75-pdf merge ms ${Math.round(elapsed)}`);

assert.equal(informalSimpleAprPercent(2), 24, '2% a month is 24% a year');
assert.equal(informalSimpleAprPercent(5), 60, '5% a month is 60% a year');
assert.ok(informalCompoundAprPercent(2) > 24, 'compound rate is higher than the simple rate');
assert.equal(standardEmiPaise(10000000, 0, 10), 1000000, 'zero-interest EMI splits the principal');
const slab = courierSlab(25, 20, 12, 450);
assert.equal(slab.volumetricGrams, 1200, '25×20×12 cm is 1,200 g');

assert.equal(Buffer.from('hi').toString('base64'), 'aGk=', 'base64 encodes hi');
assert.equal(createHash('sha256').update('hi').digest('hex').length, 64, 'sha256 is 64 hex chars');

const banned = /\/api\/pro\/(extract|smart-extract|ocr-orchestrator|reconstruct-layout|media-process)(?![\w-])/;
const uiFiles = walk(join(root, 'apps/hub/src')).filter((file) => file.includes(`${join('apps', 'hub', 'src')}`));
for (const file of uiFiles) {
  const text = readFileSync(file, 'utf8');
  assert.equal(banned.test(text), false, `${file} does not call a retired Pro route`);
}

const door = read('apps/hub/src/components/layout/SiteDoorBar.tsx');
assert.match(door, /print:hidden/, 'door bar hides in print');
assert.match(door, /lg:hidden/, 'studio pills hide on desktop');
assert.match(door, /🎤/, 'voice finder is present');
assert.match(door, /Kiswahili/, 'language list includes Kiswahili');

const owner = read('apps/hub/src/components/finance/OwnerVisualPWA.tsx');
assert.match(owner, /bg-slate-50/, 'owner uses the daylight background');
assert.match(owner, /formatOwnerAmount\(0, false\)/, 'owner free check stays in ASCII rupees');

const munshi = read('apps/hub/src/components/finance/MunshiDashboard.tsx');
assert.match(munshi, /formatOwnerAmount/, 'munshi wallet uses the paise formatter');
assert.match(munshi, /data-numerals=\{prefs\.numerals\}/, 'munshi wallet follows the numeral toggle');
const prefs = read('apps/hub/src/lib/audit/displayPrefs.ts');
assert.match(prefs, /numerals: 'latin'/, '123 is the default numeral script');

const merge = read('apps/hub/src/components/canvas/MergePdfModal.tsx');
assert.match(merge, /overflow-y-auto/, 'merge list scrolls inside the modal');
assert.match(merge, /Merge All PDFs Now/, 'merge action is pinned at the top');
assert.match(merge, /1→9 Auto-Sort/, 'natural sort is one tap');

const finance = read('apps/hub/src/components/canvas/FinanceToolGrid.tsx');
assert.match(finance, /Show 12 Advanced & Corporate Calculators/, 'finance tools collapse');
const quick = read('apps/hub/src/components/canvas/QuickToolsToolGrid.tsx');
assert.match(quick, /Show 22 Advanced, Developer & Hobby Tools/, 'quick tools collapse');
const docs = read('apps/hub/src/components/canvas/DocumentActionToolbar.tsx');
assert.match(docs, /Show All 15\+ PDF Tools/, 'document tools collapse');
assert.doesNotMatch(read('apps/hub/src/config/documentCanvasActions.ts'), /vision-ocr/, 'vision extract button is gone');

const tools = [
  ...read('apps/hub/src/config/financeCanvasTools.ts').match(/id: '[^']+'/g),
  ...read('apps/hub/src/config/quickToolsCanvasTools.ts').match(/id: '[^']+'/g),
];
assert.ok(tools.length >= 40, `registered finance and quick tools: ${tools.length}`);

console.log('ux and tool checks passed');
