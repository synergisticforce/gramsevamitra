#!/usr/bin/env node
/**
 * Force production deployments for the full GramSeva Mitra monorepo when
 * GitHub → Cloudflare webhooks stall. Uses wrangler direct upload (Pages).
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const ACCOUNT_ID = 'b440186dd17095f27299d6fb3bfcc663';
const PRODUCTION_BRANCH = process.env.CF_PAGES_BRANCH || 'main';

/** @type {{ project: string; distDir: string; buildScript: string; domain: string }[]} */
const TARGETS = [
  {
    project: 'gramsevamitra-hub',
    distDir: 'apps/hub/dist',
    buildScript: 'build:hub',
    domain: 'gramsevamitra.com',
  },
  {
    project: 'gramsevamitra-pdf',
    distDir: 'apps/pdf/dist',
    buildScript: 'build:pdf',
    domain: 'pdf.gramsevamitra.com',
  },
  {
    project: 'gramsevamitra-optimizer',
    distDir: 'apps/optimizer/dist',
    buildScript: 'build:optimizer',
    domain: 'optimizer.gramsevamitra.com',
  },
  {
    project: 'gramsevamitra-resume',
    distDir: 'apps/resume/dist',
    buildScript: 'build:resume',
    domain: 'resume.gramsevamitra.com',
  },
];

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
  return execSync(cmd, { cwd: ROOT, stdio: 'inherit', env: process.env });
}

function runCapture(cmd) {
  console.log(`\n→ ${cmd}\n`);
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', env: process.env });
}

function putPagesSecret(projectName, secretName, value) {
  if (!value) return;
  console.log(`\n→ wrangler pages secret put ${secretName} (${projectName})\n`);
  execSync(`npx wrangler pages secret put ${secretName} --project-name=${projectName}`, {
    cwd: ROOT,
    input: value,
    stdio: ['pipe', 'inherit', 'inherit'],
    env: process.env,
  });
}

function configureHubContactSecrets(projectName) {
  putPagesSecret(projectName, 'TURNSTILE_SECRET_KEY', process.env.TURNSTILE_SECRET_KEY);
  putPagesSecret(projectName, 'RESEND_API_KEY', process.env.RESEND_API_KEY);
}

function configureHubAuthSecrets(projectName) {
  putPagesSecret(projectName, 'BETTER_AUTH_SECRET', process.env.BETTER_AUTH_SECRET);
  putPagesSecret(projectName, 'GOOGLE_CLIENT_ID', process.env.GOOGLE_CLIENT_ID);
  putPagesSecret(projectName, 'GOOGLE_CLIENT_SECRET', process.env.GOOGLE_CLIENT_SECRET);
}

function configureHubRazorpaySecrets(projectName) {
  putPagesSecret(projectName, 'RAZORPAY_KEY_ID', process.env.RAZORPAY_KEY_ID);
  putPagesSecret(projectName, 'RAZORPAY_KEY_SECRET', process.env.RAZORPAY_KEY_SECRET);
  putPagesSecret(projectName, 'RAZORPAY_WEBHOOK_SECRET', process.env.RAZORPAY_WEBHOOK_SECRET);
}

async function triggerGitDeployment(token, projectName) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${projectName}/deployments`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ branch: PRODUCTION_BRANCH }),
  });

  return response.json();
}

function deployWithWrangler({ project, distDir, domain, buildScript }) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${project} → ${domain}`);
  console.log(`${'='.repeat(60)}`);

  if (project === 'gramsevamitra-hub') {
    configureHubContactSecrets(project);
    configureHubAuthSecrets(project);
    configureHubRazorpaySecrets(project);
  }

  run(`npm run ${buildScript}`);

  const distPath = join(ROOT, distDir);
  if (!existsSync(distPath)) {
    throw new Error(`Build output missing: ${distDir}`);
  }

  const configFlag = project === 'gramsevamitra-hub' ? ' --config wrangler.toml' : '';

  const output = runCapture(
    `npx wrangler pages deploy ${distDir} --project-name=${project} --branch=${PRODUCTION_BRANCH} --commit-dirty=true${configFlag}`,
  );

  const urlMatch = output.match(/https:\/\/[a-f0-9]+\.[\w-]+\.pages\.dev/i);
  const liveUrl = urlMatch?.[0] ?? `https://${domain}`;

  console.log(`\n✓ ${project} deployed`);
  console.log(`  Preview URL : ${liveUrl}`);
  console.log(`  Production  : https://${domain}`);

  return liveUrl;
}

async function forceDeploy() {
  loadEnvFile();

  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token || token.includes('your_') || token.includes('paste_')) {
    throw new Error('CLOUDFLARE_API_TOKEN is missing. Set it in .env or export it before running.');
  }

  process.env.CLOUDFLARE_API_TOKEN = token;

  console.log('GramSeva Mitra — global force deploy');
  console.log(`Branch: ${PRODUCTION_BRANCH} | Apps: ${TARGETS.length}\n`);

  run(`git fetch origin ${PRODUCTION_BRANCH}`);
  run(`git checkout ${PRODUCTION_BRANCH}`);
  run(`git pull --ff-only origin ${PRODUCTION_BRANCH}`);
  run('node scripts/sync-public.mjs');
  run('node scripts/generate-pwa-icons.mjs');

  const results = [];

  for (const target of TARGETS) {
    const apiPayload = await triggerGitDeployment(token, target.project);

    if (apiPayload.success) {
      console.log(`\n✓ ${target.project}: Cloudflare Git deployment initiated`);
      if (apiPayload.result?.url) console.log(`  URL: ${apiPayload.result.url}`);
      results.push({ project: target.project, url: apiPayload.result?.url, method: 'api' });
      continue;
    }

    const needsDirectUpload = apiPayload.errors?.some((e) => e.code === 8000096);
    if (!needsDirectUpload) {
      const message =
        apiPayload.errors?.map((e) => e.message).join('; ') || 'Unknown Cloudflare API error';
      throw new Error(`${target.project}: ${message}`);
    }

    console.warn(`\n⚠ ${target.project}: Git webhook unavailable — wrangler direct upload fallback`);
    const liveUrl = deployWithWrangler(target);
    results.push({ project: target.project, url: liveUrl, method: 'wrangler' });
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('  DEPLOYMENT SUMMARY');
  console.log(`${'='.repeat(60)}`);
  for (const { project, url, method } of results) {
    console.log(`  ${project} (${method})`);
    console.log(`    ${url ?? '—'}`);
  }
  console.log('\n✓ All monorepo apps processed successfully.\n');
}

forceDeploy().catch((err) => {
  console.error(`\n✗ ${err.message}`);
  process.exit(1);
});
