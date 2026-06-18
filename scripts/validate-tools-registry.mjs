#!/usr/bin/env node
/**
 * Validates App Model workspace routes (Phase 1+).
 * Legacy /tools/* pages were removed during the App Shell refactor.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PAGES_ROOT = path.join(ROOT, 'apps/hub/src/pages/workspace');

const WORKSPACE_ROUTES = [
  'documents',
  'image',
  'career',
  'finance',
  'quick-tools',
];

const missing = [];
for (const slug of WORKSPACE_ROUTES) {
  const file = path.join(PAGES_ROOT, `${slug}.astro`);
  if (!fs.existsSync(file)) {
    missing.push({ route: `/workspace/${slug}`, expected: file });
  }
}

if (missing.length > 0) {
  console.error('App workspace route mismatches:');
  for (const m of missing) {
    console.error(`  ${m.route} → expected ${m.expected}`);
  }
  process.exit(1);
}

console.log(`✓ App workspaces OK — ${WORKSPACE_ROUTES.length} routes verified`);
