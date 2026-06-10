#!/usr/bin/env node
/**
 * One-click deploy: build + wrangler pages deploy for hub, optimizer, resume.
 *
 * Prerequisites:
 *   npm install -g wrangler   OR   npx wrangler (via devDependency)
 *   wrangler login            OR   CLOUDFLARE_API_TOKEN env var set
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

/** Wrangler Pages API requires OAuth when CLOUDFLARE_API_TOKEN lacks Pages:Edit. */
function pagesOAuthEnv() {
  const env = { ...process.env };
  delete env.CLOUDFLARE_API_TOKEN;
  delete env.CLOUDFLARE_DNS_API_TOKEN;
  env.CLOUDFLARE_API_TOKEN = '';
  return env;
}

function runWrangler(args, opts = {}) {
  const result = spawnSync('npx', ['wrangler', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
    env: pagesOAuthEnv(),
    ...opts,
  });
  return result;
}

/** @type {{ project: string; appDir: string; buildScript: string; domain: string }[]} */
const TARGETS = [
  {
    project: 'gramsevamitra-hub',
    appDir: 'apps/hub',
    buildScript: 'build:hub',
    domain: 'gramsevamitra.com',
    extraDomains: ['utilities.gramsevamitra.com'],
  },
  {
    project: 'gramsevamitra-optimizer',
    appDir: 'apps/optimizer',
    buildScript: 'build:optimizer',
    domain: 'optimizer.gramsevamitra.com',
  },
  {
    project: 'gramsevamitra-resume',
    appDir: 'apps/resume',
    buildScript: 'build:resume',
    domain: 'resume.gramsevamitra.com',
  },
  {
    project: 'gramsevamitra-pdf',
    appDir: 'apps/pdf',
    buildScript: 'build:pdf',
    domain: 'pdf.gramsevamitra.com',
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

function ensureProject(project) {
  const list = runWrangler(['pages', 'project', 'list']);
  if (list.status !== 0) return;
  if (list.stdout.includes(project)) {
    console.log(`  Project "${project}" exists`);
    return;
  }
  console.log(`  Creating Pages project "${project}"…`);
  run(`npx wrangler pages project create "${project}" --production-branch=main`, {
    env: pagesOAuthEnv(),
  });
}

function attachDomain(project, domain) {
  const add = runWrangler(['pages', 'domain', 'add', domain, '--project-name', project]);
  if (add.status === 0) {
    console.log(`  ✓ Custom domain attached: ${domain}`);
  } else if (add.stderr?.includes('already') || add.stdout?.includes('already')) {
    console.log(`  Custom domain already configured: ${domain}`);
  } else {
    console.warn(`  Domain attach skipped for ${domain} (configure in Cloudflare dashboard if needed).`);
  }
}

function deployProject({ project, appDir, buildScript, domain, extraDomains = [] }) {
  const dist = path.join(ROOT, appDir, 'dist');
  if (!existsSync(dist)) {
    throw new Error(`Missing ${dist}. Build failed for ${project}.`);
  }

  const deployCmd = `npx wrangler pages deploy "${dist}" --project-name="${project}" --branch=main --commit-dirty=true`;

  if (DRY_RUN) {
    console.log(`[dry-run] would run: ${deployCmd}`);
    console.log(`[dry-run] would attach domain: ${domain}`);
    for (const extra of extraDomains) console.log(`[dry-run] would attach domain: ${extra}`);
    return;
  }

  ensureProject(project);
  run(deployCmd, { env: pagesOAuthEnv() });
  attachDomain(project, domain);
  for (const extra of extraDomains) attachDomain(project, extra);
  console.log(`✓ Deployed ${project} → https://${domain}`);
}

function main() {
  console.log('GramSeva Mitra — deploy:all');
  if (DRY_RUN) console.log('(dry-run mode — no builds or uploads)\n');

  if (!DRY_RUN && !wranglerAvailable()) {
    throw new Error('wrangler CLI not found. Run: npm install && npx wrangler login');
  }

  if (!DRY_RUN) {
    run('node scripts/cf-auth.mjs');
  }

  run('node scripts/sync-public.mjs');
  run('node scripts/generate-pwa-icons.mjs');

  for (const target of TARGETS) {
    run(`npm run ${target.buildScript}`);
    deployProject(target);
  }

  console.log('\n✓ All four apps built and deployed to Cloudflare Pages.');
  console.log('  hub       → gramsevamitra-hub');
  console.log('  optimizer → gramsevamitra-optimizer');
  console.log('  resume    → gramsevamitra-resume');
  console.log('  pdf       → gramsevamitra-pdf');
}

try {
  main();
} catch (err) {
  console.error(`\nDeploy failed: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
