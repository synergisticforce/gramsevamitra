import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatMinorUnits } from '../functions/_lib/currency.mjs';
import {
  applyBulkUpload,
  buildOwnerWhatsAppMessage,
  formatOwnerAmount,
  whatsAppShareUrl,
} from '../functions/_lib/ownerExperience.mjs';

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

const sources = [
  'apps/hub/src/pages/owner/index.astro',
  'apps/hub/src/pages/munshi/index.astro',
  'apps/hub/src/pages/seller/index.astro',
  'apps/hub/src/pages/admin/index.astro',
  'apps/hub/src/components/finance/OwnerVisualPWA.tsx',
  'apps/hub/src/components/finance/MunshiDashboard.tsx',
  'apps/hub/src/components/finance/EcommerceSellerWorkspace.tsx',
  'apps/hub/src/components/finance/AdminCellQueue.tsx',
  'apps/hub/src/components/layout/SiteDoorBar.tsx',
];
for (const relative of sources) {
  assert(fs.existsSync(path.join(root, relative)), `${relative} exists`);
}

const latin = formatMinorUnits(12300, '₹', 100, false);
const indic = formatMinorUnits(12300, '₹', 100, true);
assert(latin.includes('123') && !latin.includes('१'), 'latin numerals keep 123');
assert(indic.includes('१२३') && !indic.includes('123'), 'devanagari numerals use १२३');
assert(formatOwnerAmount(450000, true).includes('४') && formatOwnerAmount(450000, false).includes('4,500'), 'grouped owner amount follows the numeral toggle');

const message = buildOwnerWhatsAppMessage({
  platform: 'SWIGGY',
  totalRecoverablePaise: 450000,
  ownerPocketPaise: 405000,
  unlockFeePaise: 45000,
  tickets: ['Commission on 1849000029 is above the contract.'],
});
const share = whatsAppShareUrl(message);
assert(share.startsWith('https://wa.me/?text=') && decodeURIComponent(share).includes('1849000029'), 'WhatsApp share carries the dispute ticket');

let desk = applyBulkUpload([], { fileName: 'notes.pdf', rejected: true });
assert(desk.transition === 'rejected' && desk.clients.length === 0, 'a rejected file does not become a client');
desk = applyBulkUpload(desk.clients, { fileName: 'swiggy.xlsx', recoverablePaise: 450000, unlockFeePaise: 45000, heldCount: 0, cellCount: 0 });
assert(desk.transition === 'leak' && desk.added.munshiCutPaise === 13500, 'a leaking file is a leak and the munshi cut is ₹135');
desk = applyBulkUpload(desk.clients, { fileName: 'swiggy.xlsx', recoverablePaise: 0, unlockFeePaise: 0, heldCount: 0, cellCount: 0 });
assert(desk.transition === 'clean' && desk.clients.length === 1 && desk.clients[0].status === 'clean', 'uploading the same file again replaces it with a clean result');
desk = applyBulkUpload(desk.clients, { fileName: 'flipkart.xlsx', recoverablePaise: 120000, unlockFeePaise: 12000, heldCount: 0, cellCount: 1 });
assert(desk.transition === 'cell', 'a verification cell is its own status');
desk = applyBulkUpload(desk.clients, { fileName: 'meesho.xlsx', recoverablePaise: 30820, unlockFeePaise: 3082, heldCount: 2, cellCount: 0 });
assert(desk.transition === 'held' && desk.clients.length === 3, 'held orders stay a separate status');

const built = {
  'owner/index.html': 'Owner App',
  'munshi/index.html': 'Munshi Desk',
  'seller/index.html': 'Seller Hub',
  'admin/index.html': 'Admin Queue',
};
for (const [page, marker] of Object.entries(built)) {
  const full = path.join(root, 'apps/hub/dist', page);
  const html = fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
  assert(html.includes(marker), `${page} is in the built site`);
}

if (failed) {
  console.error(`${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('phase 6 UI checks passed');
