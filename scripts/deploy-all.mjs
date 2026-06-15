#!/usr/bin/env node
/**
 * One-click deploy: build + wrangler pages deploy for the unified Hub app.
 *
 * Usage:
 *   npm run deploy:all
 *   npm run deploy:all -- --dry-run
 */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

function pagesOAuthEnv() {
  const env = { ...process.env };
  delete env.CLOUDFLARE_API_TOKEN;
  delete env.CLOUDFLARE_DNS_API_TOKEN;
  env.CLOUDFLARE_API_TOKEN = '';
  return env;
}

function runWrangler(args, opts = {}) {
  return spawnSync('npx', ['wrangler', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
    env: pagesOAuthEnv(),
    ...opts,
  });
}

/** @type {{ project: string; appDir: string; buildScript: string; domain: string; extraDomains?: string[] }[]} */
const TARGETS = [
  {
    project: 'gramsevamitra-hub',
    appDir: 'apps/hub',
    buildScript: 'build:hub',
    domain: 'gramsevamitra.com',
    extraDomains: ['utilities.gramsevamitra.com'],
  },
];

function run(cmd, opts = {}) {
  console.log(`\n→ ${cmd}`);
  if (DRY_RUN) return;
  execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...opts });
}

function wranglerAvailable() {
  const result = spawnSync('npx', ['wrangler', '--version'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
  });
  return result.status === 0;
}

function main() {
  if (!wranglerAvailable()) {
    console.error('wrangler CLI not found. Run: npm install');
    process.exit(1);
  }

  for (const target of TARGETS) {
    const distDir = path.join(ROOT, target.appDir, 'dist');
    console.log(`\n=== ${target.project} (${target.domain}) ===`);

    run(`npm run ${target.buildScript}`);

    if (!existsSync(distDir)) {
      console.error(`Missing dist: ${distDir}`);
      process.exit(1);
    }

    const deployArgs = [
      'pages',
      'deploy',
      distDir,
      `--project-name=${target.project}`,
      '--branch=main',
      '--commit-dirty=true',
    ];

    if (DRY_RUN) {
      console.log(`[dry-run] npx wrangler ${deployArgs.join(' ')}`);
      continue;
    }

    const result = runWrangler(deployArgs);
    if (result.status !== 0) {
      console.error(result.stderr || result.stdout);
      process.exit(result.status ?? 1);
    }

    console.log(`✓ Deployed ${target.project} → ${target.domain}`);
    if (target.extraDomains?.length) {
      for (const domain of target.extraDomains) {
        console.log(`  (also serves ${domain})`);
      }
    }
  }

  console.log('\nDeploy complete.');
  console.log('  hub → gramsevamitra-hub (gramsevamitra.com + utilities.gramsevamitra.com)');
}

main();
