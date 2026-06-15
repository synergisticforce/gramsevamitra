#!/usr/bin/env node
/**
 * Production deploy orchestrator: auth → build → deploy → verify.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const LIVE_ENDPOINTS = [
  { name: 'hub', url: 'https://gramsevamitra.com', dist: 'apps/hub/dist/_headers' },
];

function run(cmd) {
  console.log(`\n→ ${cmd}\n`);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
}

function verifyDistHeaders() {
  for (const target of LIVE_ENDPOINTS) {
    const headersPath = path.join(ROOT, target.dist);
    if (!existsSync(headersPath)) {
      throw new Error(`Missing compiled _headers: ${headersPath}`);
    }
    const content = readFileSync(headersPath, 'utf8');
    if (!content.includes('X-Robots-Tag: index, follow')) {
      throw new Error(`${target.name}: _headers missing "X-Robots-Tag: index, follow"`);
    }
    console.log(`✓ ${target.name}: _headers compiled with index,follow`);
  }
}

async function verifyLiveEndpoints() {
  console.log('\n=== Live endpoint verification ===');
  for (const target of LIVE_ENDPOINTS) {
    try {
      const res = await fetch(target.url, { redirect: 'follow' });
      const robots = res.headers.get('x-robots-tag') || '(not set at edge yet)';
      console.log(`${target.url} → HTTP ${res.status} | X-Robots-Tag: ${robots}`);
    } catch (err) {
      console.error(`${target.url} → unreachable (${err instanceof Error ? err.message : err})`);
    }
  }

  const previewUrl = 'https://gramsevamitra-hub.pages.dev/';
  try {
    const res = await fetch(previewUrl, { redirect: 'follow' });
    const robots = res.headers.get('x-robots-tag') || '(preview — noindex via Pages env)';
    console.log(`${previewUrl} → HTTP ${res.status} | X-Robots-Tag: ${robots}`);
  } catch {
    console.log(`${previewUrl} → not yet provisioned or DNS pending`);
  }
}

async function main() {
  console.log('GramSeva Mitra — PRODUCTION DEPLOY\n');

  run('node scripts/cf-auth.mjs');
  run('node scripts/sync-public.mjs');
  run('node scripts/generate-pwa-icons.mjs');
  run('npm run build');
  verifyDistHeaders();
  run('node scripts/deploy-all.mjs');
  await verifyLiveEndpoints();
  console.log('\n✓ Production deployment workflow complete.');
}

main().catch((err) => {
  console.error(`\nProduction deploy aborted: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
