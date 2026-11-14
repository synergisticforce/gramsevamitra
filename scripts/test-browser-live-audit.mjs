/**
 * Opens the built site in headless Chromium and checks real contrast and clicks.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { PDFDocument } from '@cantoo/pdf-lib';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'apps/hub/dist');
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

function startServer() {
  const server = createServer((request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = join(dist, pathname);
    if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) {
      response.writeHead(404);
      response.end('missing');
      return;
    }
    response.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
    response.end(readFileSync(file));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, origin: `http://127.0.0.1:${address.port}` });
    });
  });
}

const pages = ['/', '/owner/', '/seller/', '/munshi/', '/admin/', '/workspace/documents/', '/workspace/image/', '/workspace/finance/', '/workspace/quick-tools/', '/workspace/lifestyle/', '/workspace/career/', '/workspace/video/', '/workspace/media/', '/pricing/', '/about/', '/contact/', '/privacy/', '/terms/', '/refund-policy/', '/disclaimer/', '/offline/', '/billing/success/', '/billing/cancel/', '/billing/mobile-checkout/', '/workspace/legal/', '/workspace/legal/privacy/', '/workspace/legal/terms/', '/workspace/legal/refund/', '/404.html'];

function toolLabels(rel) {
  const text = readFileSync(join(root, rel), 'utf8');
  const labels = [];
  for (const block of text.split(/\n  \{/)) {
    if (!/id: '/.test(block)) continue;
    const label = block.match(/label: '([^']+)'/);
    if (label) labels.push(label[1]);
  }
  return [...new Set(labels)];
}

function contrastProbe() {
  const parse = (value) => {
    const match = String(value).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
    if (!match) return null;
    return [Number(match[1]), Number(match[2]), Number(match[3]), match[4] == null ? 1 : Number(match[4])];
  };
  const lum = (rgb) => {
    const parts = rgb.map((part) => {
      const channel = part / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2];
  };
  const backgroundOf = (element) => {
    let node = element;
    while (node) {
      const style = getComputedStyle(node);
      const parsed = parse(style.backgroundColor);
      if (parsed && parsed[3] > 0.2) return parsed;
      node = node.parentElement;
    }
    return [248, 250, 252, 1];
  };
  const problems = [];
  const nodes = document.querySelectorAll('body *');
  for (const element of nodes) {
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const box = element.getBoundingClientRect();
    if (box.width < 2 || box.height < 2) continue;
    if (style.opacity === '0' && style.pointerEvents !== 'none') {
      problems.push(`invisible overlay ${element.tagName}`);
      continue;
    }
    const text = (element.childNodes.length ? Array.from(element.childNodes).filter((node) => node.nodeType === 3).map((node) => node.textContent).join('') : '').trim();
    if (!text) continue;
    const svg = element.namespaceURI === 'http://www.w3.org/2000/svg';
    const ink = parse(svg ? style.fill : style.color) || parse(style.color);
    if (!ink || ink[3] < 0.2) continue;
    const paper = backgroundOf(element);
    if (lum(ink) > 0.72 && lum(paper) > 0.72) {
      problems.push(`${element.tagName} "${text.slice(0, 40)}" ink ${style.color} on ${paper.slice(0, 3).join(',')}`);
    }
    if (problems.length > 12) break;
  }
  return problems;
}

const { server, origin } = await startServer();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.addInitScript(() => {
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    /* private mode */
  }
});
const failures = [];
const counts = {};
let clicked = 0;

try {
  for (const path of pages) {
    const errors = [];
    page.removeAllListeners('pageerror');
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${origin}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(800);
    const problems = await page.evaluate(contrastProbe);
    if (problems.length) failures.push(`${path} contrast: ${problems.join(' | ')}`);
    const serious = errors.filter((message) => !/Turnstile|Minified React error #41[83]|Minified React error #423/.test(message));
    if (serious.length) failures.push(`${path} pageerror: ${serious.join(' | ')}`);
  }

  const laterErrors = [];
  page.removeAllListeners('pageerror');
  page.on('pageerror', (error) => laterErrors.push(error.message));

  await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'All Tools' }).first().click();
  await page.getByRole('dialog', { name: 'All Tools' }).waitFor();
  await page.getByRole('button', { name: 'Close all tools' }).click();

  await page.getByRole('button', { name: /Language digits and currency/ }).click();
  await page.getByRole('button', { name: 'हिंदी' }).click();
  await page.getByRole('button', { name: '१२३' }).click();
  await page.getByRole('button', { name: 'English' }).click();
  await page.getByRole('button', { name: '123' }).click();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Speak a tool name' }).click();
  await page.getByRole('dialog', { name: 'Voice and tool search' }).waitFor();
  await page.getByRole('dialog', { name: 'Voice and tool search' }).getByRole('link', { name: 'Check My Money', exact: true }).waitFor();
  await page.keyboard.press('Escape');

  await page.goto(`${origin}/owner/`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Zomato', exact: true }).click();
  await page.getByText(/₹/).first().waitFor();
  await page.goto(`${origin}/owner/`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Swiggy', exact: true }).click();
  await page.getByText(/₹/).first().waitFor();

  await page.goto(`${origin}/munshi/`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Load sample clients' }).click();
  await page.getByRole('button', { name: /Master Tally CSV/ }).waitFor();
  await page.getByRole('button', { name: /Master CA Summary/ }).waitFor();

  await page.goto(`${origin}/workspace/documents/`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Join \/ Merge PDFs/ }).waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: 'Show All 15+ PDF Tools' }).click();
  await page.getByRole('button', { name: 'Compress' }).waitFor();
  await page.getByRole('button', { name: /Join \/ Merge PDFs/ }).click();
  const folder = mkdtempSync(join(tmpdir(), 'gsm-pdf-'));
  const files = [];
  for (const name of ['1.pdf', '2.pdf', '3.pdf']) {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const path = join(folder, name);
    writeFileSync(path, await pdf.save());
    files.push(path);
  }
  await page.locator('input[type="file"]').first().setInputFiles(files);
  await page.getByRole('button', { name: '1→9 Auto-Sort' }).waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: 'Merge All PDFs Now' }).first().click();

  await page.goto(`${origin}/workspace/image/`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Passport Photo/ }).waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: /Passport Photo/ }).click();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const pngPath = join(folder, 'tiny.png');
  writeFileSync(pngPath, png);
  await page.locator('input[type="file"]').first().setInputFiles(pngPath);
  counts.sampleFlows = 2;
  clicked += 2;

  async function clickLabel(label) {
    return page.evaluate((wanted) => {
      const nodes = [...document.querySelectorAll('button, summary')];
      const match = nodes.find((node) => {
        const lines = node.innerText.split('\n').map((line) => line.trim()).filter(Boolean);
        return lines.some((line) => line === wanted || line.endsWith(` ${wanted}`));
      });
      if (!match) return false;
      match.click();
      return true;
    }, label);
  }

  async function openEach(key, route, labels, options) {
    await page.goto(`${origin}${route}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    if (options.heading) await page.getByRole('heading', { name: options.heading }).first().waitFor({ timeout: 20000 });
    else if (options.ready) await page.getByRole('button', { name: options.ready }).first().waitFor({ timeout: 20000 });
    else await page.waitForTimeout(400);
    if (options.file) await page.locator('input[type="file"]').first().setInputFiles(options.file);
    if (options.afterFile) await page.getByRole('button', { name: options.afterFile }).first().waitFor({ timeout: 15000 });
    let opened = 0;
    for (const label of labels) {
      const back = page.getByRole('button', { name: /Back to Tools|Back to 4 PDF Tasks|Back to photo tasks/ });
      if (await back.isVisible().catch(() => false)) await back.click();
      let found = await clickLabel(label);
      if (!found && options.drawer) {
        await clickLabel(options.drawer);
        found = await clickLabel(label);
      }
      if (!found) {
        failures.push(`${key} missing button: ${label}`);
        continue;
      }
      if (options.expect) await page.getByText(options.expect).first().waitFor({ timeout: 8000 });
      const problems = await page.evaluate(contrastProbe);
      if (problems.length) failures.push(`${key} ${label}: ${problems[0]}`);
      if (options.closeDialog) {
        await page.keyboard.press('Escape');
        const close = page.getByRole('button', { name: /^(Close|Cancel)/ }).first();
        if (await close.isVisible().catch(() => false)) await close.click();
      }
      opened += 1;
      clicked += 1;
    }
    counts[key] = opened;
  }

  const financeLabels = toolLabels('apps/hub/src/config/financeCanvasTools.ts');
  const quickLabels = toolLabels('apps/hub/src/config/quickToolsCanvasTools.ts');
  const lifeLabels = toolLabels('apps/hub/src/config/lifestyleCanvasTools.ts');
  const videoLabels = toolLabels('apps/hub/src/config/videoCanvasTools.ts');
  const careerLabels = toolLabels('apps/hub/src/config/careerCanvasActions.ts');
  const pdfLabels = [...new Set([
    'Join / Merge PDFs',
    'Shrink PDF (Govt Form)',
    'PDF to Excel / Word',
    'Split / Remove Pages',
    ...toolLabels('apps/hub/src/config/documentCanvasActions.ts'),
  ])];
  const photoLabels = [...new Set([
    'Passport Photo & 4×6 Sheet',
    'Shrink Photo (<100 KB)',
    'Remove Background',
    'Make Photo Clear',
    ...toolLabels('apps/hub/src/config/mediaCanvasActions.ts'),
  ])];

  await openEach('finance', '/workspace/finance/', financeLabels, {
    heading: 'Finance Hub',
    drawer: 'Show 12 Advanced & Corporate Calculators',
    expect: 'Back to Tools',
  });
  await openEach('quick', '/workspace/quick-tools/', quickLabels, {
    heading: 'Quick Tools',
    drawer: 'Show 22 Advanced, Developer & Hobby Tools',
    expect: 'Back to Tools',
  });
  await openEach('lifestyle', '/workspace/lifestyle/', lifeLabels, {
    heading: 'Health & Lifestyle',
    expect: 'Back to Tools',
  });

  const clipPath = join(folder, 'clip.mp4');
  writeFileSync(clipPath, Buffer.from('gsm-video-placeholder'));
  await openEach('video', '/workspace/video/', videoLabels, {
    heading: 'Video Studio',
    file: clipPath,
    afterFile: videoLabels[0],
    expect: 'Back to Tools',
  });

  await openEach('career', '/workspace/career/', careerLabels, {
    heading: 'Career Prep',
    file: files[0],
    afterFile: 'ATS Scanner',
    closeDialog: true,
  });

  await openEach('documents', '/workspace/documents/', pdfLabels, {
    ready: /Join \/ Merge PDFs/,
    drawer: 'Show All 15+ PDF Tools',
    expect: 'Step 2: Choose Files',
  });
  await openEach('image', '/workspace/image/', photoLabels, {
    ready: /Passport Photo/,
    drawer: 'Show All Photo Tools',
    expect: 'Step 2: Choose a photo',
  });

  await page.setViewportSize({ width: 360, height: 800 });
  const mobilePaths = ['/', '/owner/', '/workspace/documents/', '/workspace/image/', '/workspace/finance/'];
  for (const path of mobilePaths) {
    await page.goto(`${origin}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(500);
    const nav = page.getByRole('navigation', { name: 'Phone tools' });
    await nav.waitFor();
    const box = await nav.boundingBox();
    if (!box || box.y + box.height > 810 || box.width < 200) failures.push(`${path} bottom nav not on screen`);
    const layout = await page.evaluate(() => {
      const view = document.documentElement.clientWidth;
      const clipped = [];
      for (const el of document.querySelectorAll('a, button')) {
        const rect = el.getBoundingClientRect();
        if (rect.width < 20 || rect.height < 20) continue;
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none') continue;
        if (rect.right > view + 4) clipped.push((el.innerText || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 40));
      }
      return { scroll: document.documentElement.scrollWidth, clipped: clipped.slice(0, 5) };
    });
    if (layout.scroll > 365) failures.push(`${path} mobile scrollWidth ${layout.scroll}`);
    if (layout.clipped.length) failures.push(`${path} clipped: ${layout.clipped.join(', ')}`);
  }
  await page.getByRole('navigation', { name: 'Phone tools' }).getByRole('link', { name: 'PDF' }).click();
  await page.waitForURL(/\/workspace\/documents\//);
  counts.mobileViewports = mobilePaths.length;

  const seriousLater = laterErrors.filter((message) => !/Turnstile|Minified React error #41[83]|Minified React error #423/.test(message));
  if (seriousLater.length) failures.push(`pageerror: ${[...new Set(seriousLater)].slice(0, 6).join(' | ')}`);

  console.log(`clicked tools ${clicked}`);
  console.log(JSON.stringify(counts));
} finally {
  await browser.close();
  server.close();
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`headless chromium contrast and click checks passed (${clicked} tool opens)`);
