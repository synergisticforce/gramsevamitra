import { ensureAuditTables } from './auditDb.mjs';

/**
 * Idempotent Neon setup. Safe to call on every paid API request.
 * Existing Better Auth rows are left untouched because every statement is CREATE IF NOT EXISTS.
 */

/** @type {Promise<void> | null} */
let ready = null;

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
    image TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    plan TEXT NOT NULL DEFAULT 'free',
    credits INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    token TEXT NOT NULL UNIQUE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMPTZ,
    "refreshTokenExpiresAt" TIMESTAMPTZ,
    scope TEXT,
    password TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS verifications (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS billing_events (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    razorpay_order_id TEXT NOT NULL UNIQUE,
    razorpay_payment_id TEXT,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    amount_paise INTEGER NOT NULL DEFAULT 9900,
    status TEXT NOT NULL DEFAULT 'captured',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_userId_idx ON sessions ("userId")`,
  `CREATE INDEX IF NOT EXISTS accounts_userId_idx ON accounts ("userId")`,
  `CREATE INDEX IF NOT EXISTS verifications_identifier_idx ON verifications (identifier)`,
  `CREATE INDEX IF NOT EXISTS billing_events_user_id_idx ON billing_events (user_id)`,
  `CREATE TABLE IF NOT EXISTS career_ai_usage (
    subject_key TEXT NOT NULL,
    period_key TEXT NOT NULL,
    used_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (subject_key, period_key)
  )`,
  `CREATE TABLE IF NOT EXISTS guest_ai_quotas (
    subject_key TEXT NOT NULL,
    period_key TEXT NOT NULL,
    product TEXT NOT NULL,
    used_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (subject_key, period_key, product)
  )`,
];

/**
 * @param {import('@neondatabase/serverless').NeonQueryFunction} sql
 */
export function ensureNeonSchema(sql) {
  if (!ready) {
    ready = (async () => {
      for (const statement of STATEMENTS) {
        await sql.query(statement);
      }
      await ensureAuditTables(sql);
    })().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}
