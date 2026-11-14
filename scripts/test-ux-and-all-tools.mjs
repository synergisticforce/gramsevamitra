/**
 * UI guardrails plus a 75-PDF merge stress check.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { PDFDocument } from '@cantoo/pdf-lib';
import * as XLSX from 'xlsx';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (rel) => import(pathToFileURL(join(root, rel)).href);
const read = (rel) => readFileSync(join(root, rel), 'utf8');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      walk(full, out);
    } else if (/\.(tsx|ts|astro|jsx|js|html)$/.test(name)) out.push(full);
  }
  return out;
}

const { naturalPdfNameSort, mergePdfBytesSequentially, needsLargeMergeWarning } = await load('functions/_lib/pdfMergeBatch.mjs');
const { resolveSpeakLanguage } = await load('functions/_lib/voiceFallback.mjs');
const { auditUploadedWorkbook } = await load('functions/_lib/adapters/registry.mjs');
const { buildEvidencePackWorkbook } = await load('functions/_lib/evidencePack.mjs');
const { buildMasterTallyCsv, buildMasterCaWorkbook } = await load('functions/_lib/munshiMasterExport.mjs');
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
assert.equal(standardEmiPaise(0, 12, 12), 0, 'a zero principal has no EMI');
assert.equal(informalSimpleAprPercent(0), 0, 'a zero monthly rate stays zero');
assert.equal(resolveSpeakLanguage('sw', [{ lang: 'sw-KE' }]).lang, 'sw-KE', 'installed Kiswahili voice is used');
assert.equal(resolveSpeakLanguage('ta', [{ lang: 'en-IN' }]).fallback, true, 'missing Tamil voice falls back');
assert.equal(needsLargeMergeWarning(Array.from({ length: 21 }, () => ({ size: 1 }))), true, '21 files warn before merge');
assert.equal(needsLargeMergeWarning([{ size: 10 }, { size: 10 }]), false, 'two small files do not warn');

const globalCsv = 'Order ID,Gross Amount,Fee,Shipping,Tax,Net Settled\nUE-1,100.00,10.00,5.00,2.00,80.00\nUE-2,50.00,10.00,0,0,30.00\n';
const globalAudit = await auditUploadedWorkbook(globalCsv, 'doordash.csv', {}, { currencySymbol: '$' });
assert.equal(globalAudit.statement.platform, 'UNIVERSAL', 'a non-Indian payout uses the universal auditor');
assert.equal(globalAudit.statement.currencySymbol, '$', 'the selected currency is kept');
assert.equal(globalAudit.auditResult.totalRecoverablePaise, 1300, 'short rows are 300 and 1000 minor units');
const globalPack = buildEvidencePackWorkbook(globalAudit.statement, globalAudit.auditResult, globalAudit.taxPackage);
const globalBook = XLSX.read(globalPack.bytes, { type: 'array' });
const summaryText = XLSX.utils.sheet_to_csv(globalBook.Sheets[globalBook.SheetNames[0]]);
assert.match(summaryText, /\$/, 'the evidence pack uses the dollar sign');

const clients = [1, 2, 3, 4, 5].map((index) => ({
  fileName: `client-${index}.xlsx`,
  platform: 'SWIGGY',
  recoverablePaise: 10000 * index,
  munshiCutPaise: 3000 * index,
  statement: { bankUtr: `UTR${index}`, declaredSummaryNetPayoutPaise: 50000 },
  tax: { totalPlatformFeesPaise: 2000, gstr2bInputTaxCredit18PctPaise: 1800, form26asTds194OPaise: 100, gstr8TcsSec52Paise: 50 },
}));
const masterCsv = buildMasterTallyCsv(clients);
assert.match(masterCsv, /client-1.xlsx/, 'master tally includes the first client');
assert.match(masterCsv, /client-5.xlsx/, 'master tally includes the fifth client');
assert.match(masterCsv, /18% GST ITC/, 'master tally has the GST column');
const masterBook = XLSX.read(buildMasterCaWorkbook(clients), { type: 'array' });
const masterRows = XLSX.utils.sheet_to_json(masterBook.Sheets['All clients']);
assert.equal(masterRows.length, 5, 'the CA workbook has five client rows');
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
assert.match(door, /☰ All Tools/, 'the header opens one all-tools drawer');
assert.match(door, /Voice Guide/, 'voice guide is one header control');
assert.match(door, /🎤/, 'voice finder is present');
assert.match(door, /Kiswahili/, 'language list includes Kiswahili');
const home = read('apps/hub/src/components/home/HomeGateway.tsx');
assert.match(home, /Check My Money/, 'home has the money door');
assert.match(home, /Join & Fix PDF/, 'home has the PDF door');
assert.match(home, /Passport & ID Photo/, 'home has the photo door');
assert.match(home, /Loan & Shop Tools/, 'home has the loan door');
const documents = read('apps/hub/src/components/canvas/DocumentStudioCanvas.tsx');
assert.match(documents, /📄1 \+ 📄2 ➔ 📘/, 'document studio leads with merge');
assert.match(documents, /🐘 ➔ 🐜 100 KB/, 'document studio leads with shrink');
const images = read('apps/hub/src/components/canvas/MediaLabCanvas.tsx');
assert.match(images, /🧑 ➔ 🪪 8 Photos/, 'image studio leads with the passport sheet');

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

const dist = join(root, 'apps/hub/dist');
const pages = walk(dist).filter((file) => file.endsWith('index.html') || file.endsWith('404.html'));
assert.ok(pages.length >= 29, `built pages: ${pages.length}`);
for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  assert.match(html, /<html/i, `${page} is html`);
  assert.doesNotMatch(html, /\{\{/, `${page} has no template braces`);
  if (!/location\.replace/.test(html)) {
    assert.match(html, /<(main|header|nav)\b/i, `${page} has a landmark`);
  }
  const links = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
  for (const link of links) {
    const clean = link.split('?')[0].split('#')[0];
    if (!clean.startsWith('/') || clean.startsWith('//')) continue;
    if (!/\/_astro\/|\.(css|js|mjs|png|svg|webp|ico|txt|xml|json)$/.test(clean)) continue;
    assert.equal(existsSync(join(dist, clean.slice(1))), true, `${page} links to ${clean}`);
  }
}
const financeHtml = readFileSync(join(dist, 'workspace/finance/index.html'), 'utf8');
const financeScripts = [...financeHtml.matchAll(/(?:src|component-url)="(\/_astro\/[^"]+\.js)"/g)].map((match) => {
  const file = join(dist, match[1].slice(1));
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
}).join('\n');
assert.match(`${financeHtml}\n${financeScripts}`, /EMI|emi-calculator/, 'finance page ships the EMI calculator');

console.log('ux and tool checks passed');
