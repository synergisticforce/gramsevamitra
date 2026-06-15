#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const sharedPublic = path.resolve(root, 'packages/shared/public');
const rootRobots = path.resolve(root, 'robots.txt');
const apps = ['hub'];

for (const app of apps) {
  const dest = path.resolve(root, 'apps', app, 'public');
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(sharedPublic)) {
    cpSync(path.join(sharedPublic, entry), path.join(dest, entry), { recursive: true });
  }
  if (existsSync(rootRobots)) {
    cpSync(rootRobots, path.join(dest, 'robots.txt'));
  }
}

console.log('Synced public assets to hub app.');
