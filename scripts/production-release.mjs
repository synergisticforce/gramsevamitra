#!/usr/bin/env node
/**
 * End-to-end production release recovery:
 *   auth (token prompt / OAuth) → payment vault → env:live → deploy → verify → preview robots
 */
import { execSync, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const ENV_PATHS = [
  path.join(ROOT, '.env'),
  path.join(ROOT, 'apps/hub/.env'),
];

const PROJECTS = [
  { name: 'gramsevamitra-hub', domain: 'gramsevamitra.com' },
];

const PLACEHOLDER = [/your_key/i, /replace_me/i, /@your-handle/i, /your-handle/];

function run(cmd, env = process.env) {
  console.log(`\n→ ${cmd}\n`);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } });
}

function whoamiOk(env = process.env) {
  const r = spawnSync('npx', ['wrangler', 'whoami'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
    env: { ...process.env, ...env },
  });
  return r.status === 0;
}

async function promptHidden(rl, label) {
  if (process.env[label]) return process.env[label];
  const answer = await rl.question(`${label} (input hidden in log — paste value): `);
  return answer.trim();
}

async function resolveCloudflareAuth(rl) {
  if (process.env.CLOUDFLARE_API_TOKEN && whoamiOk()) {
    console.log('✓ CLOUDFLARE_API_TOKEN active');
    return process.env.CLOUDFLARE_API_TOKEN;
  }

  if (process.env.CLOUDFLARE_API_TOKEN) {
    if (whoamiOk({ CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN })) {
      console.log('✓ CLOUDFLARE_API_TOKEN validated');
      return process.env.CLOUDFLARE_API_TOKEN;
    }
    throw new Error('CLOUDFLARE_API_TOKEN is set but wrangler whoami failed. Check token permissions.');
  }

  console.log('\nOAuth login (npm run cf:login) — complete browser approval within 3 minutes…');
  try {
    run('node scripts/cf-auth.mjs');
    if (whoamiOk()) return null;
  } catch {
    console.warn('OAuth login failed or timed out — falling back to API token input.');
  }

  const token = await promptHidden(rl, 'CLOUDFLARE_API_TOKEN');
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN is required to deploy.');
  process.env.CLOUDFLARE_API_TOKEN = token;
  if (!whoamiOk()) throw new Error('Invalid CLOUDFLARE_API_TOKEN — needs Account:Read + Cloudflare Pages:Edit.');
  console.log('✓ API token accepted');
  return token;
}

function parseEnv(content) {
  const lines = content.split('\n');
  const map = new Map();
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    map.set(t.slice(0, i).trim(), t.slice(i + 1).trim());
  }
  return map;
}

function serializeEnv(map, original) {
  const out = [];
  const written = new Set();
  for (const line of original.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) {
      out.push(line);
      continue;
    }
    const key = t.slice(0, t.indexOf('=')).trim();
    if (!written.has(key)) {
      out.push(`${key}=${map.get(key) ?? ''}`);
      written.add(key);
    }
  }
  for (const [k, v] of map) {
    if (!written.has(k)) out.push(`${k}=${v}`);
  }
  return out.join('\n').replace(/\n?$/, '\n');
}

async function resolvePaymentVault(rl) {
  const envPath = ENV_PATHS[0];
  if (!existsSync(envPath)) copyFileSync(path.join(ROOT, '.env.example'), envPath);

  const original = readFileSync(envPath, 'utf8');
  const map = parseEnv(original);

  let razorpay = process.env.GRAMSEVA_LIVE_RAZORPAY_KEY || map.get('PAYMENT_VAULT_LIVE_RAZORPAY_KEY_ID') || '';
  let instamojo = process.env.GRAMSEVA_LIVE_INSTAMOJO_LINK || map.get('PAYMENT_VAULT_LIVE_INSTAMOJO_LINK') || '';

  if (!razorpay || PLACEHOLDER.some((p) => p.test(razorpay))) {
    razorpay = await rl.question('LIVE Razorpay Key ID (rzp_live_…): ');
  }
  if (!instamojo || PLACEHOLDER.some((p) => p.test(instamojo))) {
    instamojo = await rl.question('LIVE Instamojo payment link (https://…): ');
  }

  if (!razorpay.startsWith('rzp_live_')) throw new Error('LIVE Razorpay key must start with rzp_live_');
  if (!instamojo.startsWith('http')) throw new Error('Instamojo link must be a valid URL');

  map.set('PAYMENT_VAULT_LIVE_RAZORPAY_KEY_ID', razorpay.trim());
  map.set('PAYMENT_VAULT_LIVE_INSTAMOJO_LINK', instamojo.trim());
  map.set('PAYMENT_ENV', 'LIVE');
  map.set('PUBLIC_RAZORPAY_KEY_ID', razorpay.trim());
  map.set('PUBLIC_INSTAMOJO_PAYMENT_LINK', instamojo.trim());

  const serialized = serializeEnv(map, original);
  for (const p of ENV_PATHS) writeFileSync(p, serialized, 'utf8');
  console.log('✓ LIVE payment vault written to all .env files (values not logged).');
  run('node scripts/toggle-env.js live');
}

async function setPagesPreviewRobots(token) {
  const accountRes = spawnSync(
    'curl',
    ['-s', '-H', `Authorization: Bearer ${token}`, 'https://api.cloudflare.com/client/v4/accounts'],
    { encoding: 'utf8' }
  );
  let accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) {
    try {
      const data = JSON.parse(accountRes.stdout);
      accountId = data?.result?.[0]?.id;
    } catch {
      /* ignore */
    }
  }
  if (!accountId) {
    console.warn('Could not resolve CLOUDFLARE_ACCOUNT_ID — set preview PUBLIC_ROBOTS manually in dashboard.');
    return;
  }

  for (const { name } of PROJECTS) {
    const getRes = spawnSync(
      'curl',
      [
        '-s',
        '-H',
        `Authorization: Bearer ${token}`,
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${name}`,
      ],
      { encoding: 'utf8' }
    );
    let project;
    try {
      project = JSON.parse(getRes.stdout)?.result;
    } catch {
      console.warn(`  Skip preview env for ${name} (project not found yet)`);
      continue;
    }
    if (!project) continue;

    const deploymentConfigs = project.deployment_configs || {};
    const preview = deploymentConfigs.preview || { env_vars: {} };
    preview.env_vars = preview.env_vars || {};
    preview.env_vars.PUBLIC_ROBOTS = { value: 'noindex, nofollow' };

    const production = deploymentConfigs.production || { env_vars: {} };
    production.env_vars = production.env_vars || {};
    delete production.env_vars.PUBLIC_ROBOTS;

    const body = JSON.stringify({
      deployment_configs: { preview, production },
    });

    const patch = spawnSync(
      'curl',
      [
        '-s',
        '-X',
        'PATCH',
        '-H',
        `Authorization: Bearer ${token}`,
        '-H',
        'Content-Type: application/json',
        '-d',
        body,
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${name}`,
      ],
      { encoding: 'utf8' }
    );
    const ok = patch.stdout.includes('"success":true');
    console.log(ok ? `✓ ${name}: Preview PUBLIC_ROBOTS=noindex,nofollow` : `  ${name}: preview env update pending (configure in dashboard)`);
  }
}

async function verifyEndpoints() {
  console.log('\n=== Live endpoint verification ===');
  for (const { domain } of PROJECTS) {
    const url = `https://${domain}`;
    try {
      const res = await fetch(url, { redirect: 'follow' });
      const robots = res.headers.get('x-robots-tag') || '(edge header pending propagation)';
      console.log(`${url} → HTTP ${res.status} | X-Robots-Tag: ${robots}`);
    } catch (e) {
      console.error(`${url} → ${e instanceof Error ? e.message : e}`);
    }
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  GramSeva Mitra — Production Release Recovery ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const token = await resolveCloudflareAuth(rl);
    await resolvePaymentVault(rl);

    run('node scripts/sync-public.mjs');
    run('node scripts/generate-pwa-icons.mjs');
    run('npm run build');

    for (const p of PROJECTS) {
      const hp = path.join(ROOT, 'apps/hub/dist', '_headers');
      const c = readFileSync(hp, 'utf8');
      if (!c.includes('X-Robots-Tag: index, follow')) throw new Error(`${p.name}: missing index,follow in _headers`);
      console.log(`✓ hub: _headers verified`);
    }

    run('node scripts/deploy-all.mjs');

    if (token || process.env.CLOUDFLARE_API_TOKEN) {
      await setPagesPreviewRobots(token || process.env.CLOUDFLARE_API_TOKEN);
    }

    await verifyEndpoints();
    console.log('\n✓ Production release complete.');
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(`\nRelease aborted: ${err instanceof Error ? err.message : err}`);
  console.error('\nNon-interactive fallback:');
  console.error('  export CLOUDFLARE_API_TOKEN="..."');
  console.error('  export GRAMSEVA_LIVE_RAZORPAY_KEY="rzp_live_..."');
  console.error('  export GRAMSEVA_LIVE_INSTAMOJO_LINK="https://..."');
  console.error('  npm run production:release');
  process.exit(1);
});
