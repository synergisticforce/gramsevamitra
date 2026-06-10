#!/usr/bin/env node
/**
 * Safely swap Razorpay / Instamojo credentials between TEST and LIVE in .env files.
 *
 * Usage:
 *   node scripts/toggle-env.js test     → activate TEST keys
 *   node scripts/toggle-env.js live     → activate LIVE keys
 *   node scripts/toggle-env.js toggle   → flip TEST ↔ LIVE
 *   node scripts/toggle-env.js status   → show current environment
 *
 * Vault keys (never overwritten):
 *   PAYMENT_VAULT_TEST_RAZORPAY_KEY_ID
 *   PAYMENT_VAULT_TEST_INSTAMOJO_LINK
 *   PAYMENT_VAULT_LIVE_RAZORPAY_KEY_ID
 *   PAYMENT_VAULT_LIVE_INSTAMOJO_LINK
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const ENV_PATHS = [
  path.join(ROOT, '.env'),
  path.join(ROOT, 'apps/hub/.env'),
  path.join(ROOT, 'apps/optimizer/.env'),
  path.join(ROOT, 'apps/resume/.env'),
];

const VAULT_KEYS = {
  TEST: {
    razorpay: 'PAYMENT_VAULT_TEST_RAZORPAY_KEY_ID',
    instamojo: 'PAYMENT_VAULT_TEST_INSTAMOJO_LINK',
  },
  LIVE: {
    razorpay: 'PAYMENT_VAULT_LIVE_RAZORPAY_KEY_ID',
    instamojo: 'PAYMENT_VAULT_LIVE_INSTAMOJO_LINK',
  },
};

const ACTIVE_KEYS = {
  env: 'PAYMENT_ENV',
  razorpay: 'PUBLIC_RAZORPAY_KEY_ID',
  instamojo: 'PUBLIC_INSTAMOJO_PAYMENT_LINK',
};

const MANAGED_KEYS = new Set([ACTIVE_KEYS.env, ACTIVE_KEYS.razorpay, ACTIVE_KEYS.instamojo]);

function parseEnv(content) {
  const lines = content.split('\n');
  const map = new Map();
  const order = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      order.push({ type: 'raw', value: line });
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      order.push({ type: 'raw', value: line });
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    map.set(key, value);
    order.push({ type: 'kv', key });
  }

  return { map, order, lines };
}

function serializeEnv(parsed, updates) {
  const map = new Map(parsed.map);
  for (const [key, value] of Object.entries(updates)) {
    map.set(key, value);
  }

  const out = [];
  const written = new Set();

  for (const entry of parsed.order) {
    if (entry.type === 'raw') {
      out.push(entry.value);
      continue;
    }
    if (!written.has(entry.key)) {
      out.push(`${entry.key}=${map.get(entry.key) ?? ''}`);
      written.add(entry.key);
    }
  }

  for (const [key, value] of map.entries()) {
    if (!written.has(key)) {
      out.push(`${key}=${value}`);
    }
  }

  return out.join('\n').replace(/\n?$/, '\n');
}

function loadPrimaryEnv() {
  const primary = ENV_PATHS[0];
  if (!existsSync(primary)) {
    const example = path.join(ROOT, '.env.example');
    if (existsSync(example)) {
      copyFileSync(example, primary);
      console.log('Created .env from .env.example — fill PAYMENT_VAULT_* values before toggling LIVE.');
    } else {
      throw new Error('Missing .env and .env.example. Create .env with PAYMENT_VAULT_* keys first.');
    }
  }
  return { path: primary, content: readFileSync(primary, 'utf8') };
}

function resolveTargetMode(arg, current) {
  const normalized = (arg || '').toLowerCase();
  if (normalized === 'test') return 'TEST';
  if (normalized === 'live') return 'LIVE';
  if (normalized === 'toggle') return current === 'LIVE' ? 'TEST' : 'LIVE';
  if (normalized === 'status') return null;
  throw new Error(`Unknown command "${arg}". Use: test | live | toggle | status`);
}

function validateVault(parsed, mode) {
  const vault = VAULT_KEYS[mode];
  const razorpay = parsed.map.get(vault.razorpay);
  const instamojo = parsed.map.get(vault.instamojo);

  if (!razorpay || razorpay.includes('replace_me') || razorpay.includes('your_key')) {
    throw new Error(
      `Missing or placeholder ${vault.razorpay}. Set real ${mode} Razorpay key in .env before switching.`
    );
  }

  if (mode === 'LIVE' && razorpay.startsWith('rzp_test_')) {
    throw new Error('LIVE mode refused: vault contains a rzp_test_ key. Use rzp_live_ keys only.');
  }

  if (mode === 'TEST' && razorpay.startsWith('rzp_live_')) {
    console.warn('Warning: TEST mode is using a rzp_live_ key — double-check your vault.');
  }

  if (!instamojo || !instamojo.startsWith('http')) {
    throw new Error(`Missing or invalid ${vault.instamojo}. Set a valid Instamojo URL.`);
  }

  return { razorpay, instamojo };
}

function mask(value) {
  if (!value || value.length < 8) return '****';
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function writeAllEnvFiles(serialized) {
  for (const envPath of ENV_PATHS) {
    writeFileSync(envPath, serialized, 'utf8');
  }
}

function main() {
  const arg = process.argv[2] || 'status';
  const { content } = loadPrimaryEnv();
  const parsed = parseEnv(content);
  const current = (parsed.map.get(ACTIVE_KEYS.env) || 'TEST').toUpperCase();
  const target = resolveTargetMode(arg, current);

  if (target === null) {
    console.log(`Payment environment: ${current}`);
    console.log(`  ${ACTIVE_KEYS.razorpay}=${mask(parsed.map.get(ACTIVE_KEYS.razorpay))}`);
    console.log(`  ${ACTIVE_KEYS.instamojo}=${parsed.map.get(ACTIVE_KEYS.instamojo) || '(unset)'}`);
    console.log('\nVault TEST Razorpay:', mask(parsed.map.get(VAULT_KEYS.TEST.razorpay)));
    console.log('Vault LIVE Razorpay: ', mask(parsed.map.get(VAULT_KEYS.LIVE.razorpay)));
    return;
  }

  const { razorpay, instamojo } = validateVault(parsed, target);

  const updates = {
    [ACTIVE_KEYS.env]: target,
    [ACTIVE_KEYS.razorpay]: razorpay,
    [ACTIVE_KEYS.instamojo]: instamojo,
  };

  const serialized = serializeEnv(parsed, updates);
  writeAllEnvFiles(serialized);

  console.log(`✓ Payment environment switched: ${current} → ${target}`);
  console.log(`  ${ACTIVE_KEYS.razorpay}=${mask(razorpay)}`);
  console.log(`  ${ACTIVE_KEYS.instamojo}=${instamojo}`);
  console.log(`  Synced to ${ENV_PATHS.length} .env file(s).`);
}

try {
  main();
} catch (err) {
  console.error(`Error: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
