/**
 * QA stress test: 3G-throttled 15 MB upload → SSC CGL photo → output strictly under 50 KB.
 */
import { execSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, '../fixtures/output/dummy-15mb-photo.jpg');
const SSC_CGL_MAX_BYTES = 50 * 1024;
const OPTIMIZER_URL = 'http://localhost:4322';

/** Chrome DevTools Protocol — Fast 3G profile (approx. 1.6 Mbps down, 750 Kbps up, 562 ms RTT). */
const NETWORK_3G = {
  offline: false,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
  latency: 562,
};

function ensureFixture() {
  if (!existsSync(FIXTURE)) {
    execSync('node tests/fixtures/generate-large-image.mjs', {
      cwd: path.resolve(__dirname, '../..'),
      stdio: 'inherit',
    });
  }
  const size = statSync(FIXTURE).size;
  expect(size).toBeGreaterThan(14 * 1024 * 1024);
  console.log(`Fixture size: ${(size / (1024 * 1024)).toFixed(2)} MB`);
}

function parseSizeToBytes(text) {
  const normalized = text.trim().toUpperCase();
  const kb = normalized.match(/^([\d.]+)\s*KB$/);
  if (kb) return Math.round(parseFloat(kb[1]) * 1024);
  const mb = normalized.match(/^([\d.]+)\s*MB$/);
  if (mb) return Math.round(parseFloat(mb[1]) * 1024 * 1024);
  const b = normalized.match(/^([\d.]+)\s*B$/);
  if (b) return Math.round(parseFloat(b[1]));
  throw new Error(`Unable to parse file size: "${text}"`);
}

async function apply3GThrottle(page) {
  const session = await page.context().newCDPSession(page);
  await session.send('Network.enable');
  await session.send('Network.emulateNetworkConditions', NETWORK_3G);
  return session;
}

test.describe('Document Optimizer — 3G stress test', () => {
  test.beforeAll(() => {
    ensureFixture();
  });

  test('compresses 15 MB image to under 50 KB (SSC CGL) without crashing', async ({ page }) => {
    await apply3GThrottle(page);

    await page.goto(OPTIMIZER_URL, { waitUntil: 'networkidle' });

    await page.waitForSelector('#exam-preset', { state: 'visible' });
    await page.selectOption('#exam-preset', 'ssc-cgl');

    const photoBtn = page.getByRole('button', { name: 'photo', exact: true });
    await photoBtn.click();

    await page.setInputFiles('#file-upload', FIXTURE);

    const optimizeBtn = page.getByRole('button', { name: 'Optimize Document' });
    await expect(optimizeBtn).toBeEnabled({ timeout: 30_000 });

    const crashPromise = page.waitForEvent('crash').then(() => {
      throw new Error('Browser tab crashed during canvas compression');
    });

    await optimizeBtn.click();

    await Promise.race([
      page.waitForSelector('h2:text("Results")', { timeout: 120_000 }),
      crashPromise,
    ]);

    const alert = page.locator('[role="alert"]');
    await expect(alert).toHaveCount(0);

    const paywall = page.locator('[aria-labelledby="paywall-title"]');
    if (await paywall.isVisible()) {
      await page.getByRole('button', { name: 'Later' }).click();
    }

    const resultItem = page.locator('li').filter({ hasText: /photo-.*\.(jpg|jpeg|png)/i }).first();
    await expect(resultItem).toBeVisible({ timeout: 30_000 });

    const sizeLine = resultItem.locator('.text-xs.text-slate-500');
    await expect(sizeLine).toBeVisible();
    const sizeText = await sizeLine.innerText();
    const sizePart = sizeText
      .split('·')
      .map((s) => s.trim())
      .find((s) => /^\d/.test(s) && /KB|MB|B/i.test(s) && !s.includes('–'));
    expect(sizePart, `Expected size segment in: ${sizeText}`).toBeTruthy();

    const outputBytes = parseSizeToBytes(sizePart.replace(/·.*quality.*/i, '').trim());
    expect(outputBytes).toBeLessThanOrEqual(SSC_CGL_MAX_BYTES);
    expect(outputBytes).toBeGreaterThan(0);

    console.log(`Output size: ${sizePart} (${outputBytes} bytes) — under ${SSC_CGL_MAX_BYTES} byte limit`);

    const dimensions = sizeText.match(/(\d+)×(\d+)px/);
    expect(dimensions).toBeTruthy();
    expect(parseInt(dimensions[1], 10)).toBeGreaterThan(0);
    expect(parseInt(dimensions[2], 10)).toBeGreaterThan(0);
  });
});
