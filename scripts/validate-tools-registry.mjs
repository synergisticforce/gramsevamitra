#!/usr/bin/env node
/**
 * Validates hub toolsRegistry.ts paths against physical Astro pages.
 * Exit 1 on mismatch — intended for CI / pre-release audits.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REGISTRY_FILE = path.join(ROOT, 'apps/hub/src/config/toolsRegistry.ts');
const PAGES_ROOT = path.join(ROOT, 'apps/hub/src/pages');

function pathToAstroFile(routePath) {
  if (routePath === '/tools') {
    return path.join(PAGES_ROOT, 'tools/index.astro');
  }
  const segments = routePath.replace(/^\//, '').split('/');
  if (segments.length === 2 && segments[0] === 'tools') {
    return path.join(PAGES_ROOT, 'tools', segments[1], 'index.astro');
  }
  if (segments.length === 3 && segments[0] === 'tools') {
    return path.join(PAGES_ROOT, 'tools', segments[1], `${segments[2]}.astro`);
  }
  return null;
}

const source = fs.readFileSync(REGISTRY_FILE, 'utf8');
const paths = [...source.matchAll(/path: '(\/tools[^']*)'/g)].map((m) => m[1]);
const uniquePaths = [...new Set(paths)];

const missing = [];
for (const routePath of uniquePaths) {
  const file = pathToAstroFile(routePath);
  if (!file || !fs.existsSync(file)) {
    missing.push({ routePath, expected: file });
  }
}

if (missing.length > 0) {
  console.error('toolsRegistry path mismatches:');
  for (const m of missing) {
    console.error(`  ${m.routePath} → expected ${m.expected}`);
  }
  process.exit(1);
}

console.log(`✓ toolsRegistry OK — ${uniquePaths.length} routes verified`);
