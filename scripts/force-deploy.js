#!/usr/bin/env node
/**
 * Force a Cloudflare Pages production deployment when GitHub webhooks stall.
 * Primary: Cloudflare Pages Git deployment API (branch trigger).
 * Fallback: sync origin/main, build PDF app, wrangler direct upload (this project's CI model).
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const ACCOUNT_ID = 'b440186dd17095f27299d6fb3bfcc663';
const PROJECT_NAME = 'gramsevamitra-pdf';
const PRODUCTION_BRANCH = process.env.CF_PAGES_BRANCH || 'main';

const API_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments`;

function loadEnvFile() {
  try {
    const envPath = join(ROOT, '.env');
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const eq = trimmed.indexOf('=');
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      value = value.replace(/^["']|["']$/g, '');
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    /* .env optional if token already exported */
  }
}

function run(cmd) {
  console.log(`\n→ ${cmd}\n`);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit', env: process.env });
}

async function triggerGitDeployment(token) {
  console.log(`→ POST ${API_URL}`);
  console.log(`  branch: ${PRODUCTION_BRANCH}`);

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ branch: PRODUCTION_BRANCH }),
  });

  const payload = await response.json();
  console.log(JSON.stringify(payload, null, 2));
  return payload;
}

async function deployViaGitOpsFallback(token) {
  console.warn(
    '\n⚠ Git branch trigger unavailable (Direct Upload Pages project).',
  );
  console.warn('  Falling back: fetch GitHub main → build → wrangler pages deploy.\n');

  run(`git fetch origin ${PRODUCTION_BRANCH}`);
  run(`git checkout ${PRODUCTION_BRANCH}`);
  run(`git pull --ff-only origin ${PRODUCTION_BRANCH}`);
  run('npm run build:pdf');
  run(
    `npx wrangler pages deploy apps/pdf/dist --project-name=${PROJECT_NAME} --branch=${PRODUCTION_BRANCH}`,
  );
}

async function forceDeploy() {
  loadEnvFile();

  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token || token.includes('your_') || token.includes('paste_')) {
    throw new Error('CLOUDFLARE_API_TOKEN is missing. Set it in .env or export it before running.');
  }

  process.env.CLOUDFLARE_API_TOKEN = token;

  console.log(`→ Force production deployment: ${PROJECT_NAME}`);

  const payload = await triggerGitDeployment(token);

  if (payload.success) {
    const deployment = payload.result;
    console.log('\n✓ Cloudflare Git deployment initiated');
    if (deployment?.id) console.log(`  ID: ${deployment.id}`);
    if (deployment?.url) console.log(`  URL: ${deployment.url}`);
    if (deployment?.environment) console.log(`  Environment: ${deployment.environment}`);
    return;
  }

  const manifestRequired = payload.errors?.some((e) => e.code === 8000096);
  if (manifestRequired) {
    await deployViaGitOpsFallback(token);
    console.log('\n✓ PDF production deployment uploaded via wrangler (GitOps fallback)');
    return;
  }

  const message = payload.errors?.map((e) => e.message).join('; ') || 'Unknown Cloudflare API error';
  throw new Error(`Cloudflare deployment trigger failed: ${message}`);
}

forceDeploy().catch((err) => {
  console.error(`\n✗ ${err.message}`);
  process.exit(1);
});
