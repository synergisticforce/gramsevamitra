#!/usr/bin/env node
import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const sharedPublic = path.resolve(root, 'packages/shared/public');
const apps = ['hub', 'optimizer', 'resume', 'pdf'];

for (const app of apps) {
  const dest = path.resolve(root, 'apps', app, 'public');
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(sharedPublic)) {
    cpSync(path.join(sharedPublic, entry), path.join(dest, entry), { recursive: true });
  }
}

console.log('Synced public assets to all apps.');
