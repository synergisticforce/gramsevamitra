#!/usr/bin/env node
/**
 * Post-build production sanity check — verifies dist output across all apps.
 * Usage: node scripts/prod-sanity-check.js
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** @type {{ name: string; dist: string }[]} */
const APPS = [
  { name: 'hub', dist: 'apps/hub/dist' },
];

/** @type {{ rel: string; label: string }[]} */
const REQUIRED_FILES = [
  { rel: 'index.html', label: 'HTML entrypoint' },
  { rel: 'manifest.webmanifest', label: 'PWA manifest' },
  { rel: '_headers', label: 'Edge _headers' },
  { rel: '_redirects', label: 'Edge _redirects' },
  { rel: '404.html', label: '404 page' },
  { rel: 'sw.js', label: 'Service worker' },
];

/** @type {{ pattern: RegExp; label: string }[]} */
const HEADER_ASSERTIONS = [
  { pattern: /sw\.js[\s\S]*Cache-Control:\s*public,\s*max-age=0,\s*must-revalidate/i, label: 'sw.js no-cache header' },
  {
    pattern: /manifest\.webmanifest[\s\S]*Cache-Control:\s*public,\s*max-age=0,\s*must-revalidate/i,
    label: 'manifest no-cache header',
  },
  {
    pattern: /\/_astro\/\*[\s\S]*Cache-Control:\s*public,\s*max-age=31536000,\s*immutable/i,
    label: '_astro immutable cache header',
  },
];

let failures = 0;

function fail(message) {
  console.error(`✗ ${message}`);
  failures += 1;
}

function pass(message) {
  console.log(`✓ ${message}`);
}

for (const app of APPS) {
  const distDir = path.join(ROOT, app.dist);
  console.log(`\n[${app.name}] ${distDir}`);

  if (!existsSync(distDir)) {
    fail(`${app.name}: dist folder missing — run npm run build first`);
    continue;
  }

  for (const file of REQUIRED_FILES) {
    const filePath = path.join(distDir, file.rel);
    if (!existsSync(filePath)) {
      fail(`${app.name}: missing ${file.label} (${file.rel})`);
    } else {
      pass(`${app.name}: ${file.label}`);
    }
  }

  const headersPath = path.join(distDir, '_headers');
  if (existsSync(headersPath)) {
    const headers = readFileSync(headersPath, 'utf8');
    for (const assertion of HEADER_ASSERTIONS) {
      if (assertion.pattern.test(headers)) {
        pass(`${app.name}: ${assertion.label}`);
      } else {
        fail(`${app.name}: _headers missing ${assertion.label}`);
      }
    }
  }

  const redirectsPath = path.join(distDir, '_redirects');
  if (existsSync(redirectsPath)) {
    const redirects = readFileSync(redirectsPath, 'utf8');
    if (redirects.includes('/*') && redirects.includes('/index.html') && redirects.includes('200')) {
      fail(`${app.name}: _redirects still uses SPA catch-all (/* /index.html 200) — use static 404.html instead`);
    } else {
      pass(`${app.name}: no SPA catch-all in _redirects`);
    }
  }
}

console.log('');
if (failures > 0) {
  console.error(`Production sanity check failed with ${failures} issue(s).`);
  process.exit(1);
}

console.log('✓ Production sanity check passed for hub.');
