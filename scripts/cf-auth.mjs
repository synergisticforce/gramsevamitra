#!/usr/bin/env node
/**
 * Cloudflare auth bootstrap for GramSeva Mitra deployments.
 *
 * Resolution order:
 *   1. CLOUDFLARE_API_TOKEN (+ optional CLOUDFLARE_ACCOUNT_ID)
 *   2. Valid wrangler OAuth session (~/.wrangler/ or macOS Preferences path)
 *   3. Interactive `wrangler login` (opens browser)
 *
 * Usage:
 *   node scripts/cf-auth.mjs           # verify or refresh auth
 *   node scripts/cf-auth.mjs --login   # force browser login
 */
import { spawnSync, execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FORCE_LOGIN = process.argv.includes('--login');

const WRANGLER_CONFIG_PATHS = [
  path.join(os.homedir(), '.wrangler', 'config', 'default.toml'),
  path.join(os.homedir(), 'Library', 'Preferences', '.wrangler', 'config', 'default.toml'),
];

function parseTomlExpiration(content) {
  const match = content.match(/expiration_time\s*=\s*"([^"]+)"/);
  return match ? new Date(match[1]) : null;
}

function readWranglerSession() {
  for (const configPath of WRANGLER_CONFIG_PATHS) {
    if (!existsSync(configPath)) continue;
    const content = readFileSync(configPath, 'utf8');
    const expires = parseTomlExpiration(content);
    return { configPath, expires, hasOAuth: /oauth_token\s*=/.test(content) };
  }
  return null;
}

function whoami() {
  const result = spawnSync('npx', ['wrangler', 'whoami'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
    env: process.env,
  });
  return { ok: result.status === 0, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function login() {
  console.log('Opening Cloudflare OAuth login (wrangler login)…');
  const result = spawnSync('npx', ['wrangler', 'login'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error('wrangler login failed. Set CLOUDFLARE_API_TOKEN manually and retry.');
  }
}

function main() {
  console.log('Cloudflare auth bootstrap');

  if (process.env.CLOUDFLARE_API_TOKEN) {
    console.log('✓ CLOUDFLARE_API_TOKEN detected — using API token auth');
    const check = whoami();
    if (check.ok) {
      console.log(check.stdout.trim());
      return;
    }
    throw new Error(
      'CLOUDFLARE_API_TOKEN is set but wrangler whoami failed. Verify token has Pages:Edit permission.'
    );
  }

  const session = readWranglerSession();
  if (session) {
    const expired = session.expires ? session.expires.getTime() < Date.now() : false;
    console.log(`Wrangler OAuth config: ${session.configPath}`);
    if (session.expires) {
      console.log(`  Expires: ${session.expires.toISOString()} ${expired ? '(EXPIRED)' : '(valid)'}`);
    }
    if (!expired && !FORCE_LOGIN) {
      const check = whoami();
      if (check.ok) {
        console.log('✓ Wrangler OAuth session active');
        console.log(check.stdout.trim());
        return;
      }
      console.warn('OAuth file present but whoami failed — attempting refresh via login…');
    } else if (expired) {
      console.warn('OAuth session expired — refresh required.');
    }
  } else {
    console.warn('No wrangler OAuth session found.');
  }

  if (process.env.CI === 'true' || process.env.CI === '1') {
    throw new Error(
      'No valid Cloudflare credentials in CI. Set CLOUDFLARE_API_TOKEN with Account + Cloudflare Pages permissions.'
    );
  }

  login();
  const after = whoami();
  if (!after.ok) {
    throw new Error('Login completed but wrangler whoami still failing.');
  }
  console.log('✓ Cloudflare authentication successful');
  console.log(after.stdout.trim());
}

try {
  main();
} catch (err) {
  console.error(`\nAuth failed: ${err instanceof Error ? err.message : err}`);
  console.error('\nTo deploy manually:');
  console.error('  export CLOUDFLARE_API_TOKEN="your_token"   # Pages:Edit + Account:Read');
  console.error('  npm run deploy:all');
  process.exit(1);
}
