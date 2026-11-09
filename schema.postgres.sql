-- GramSeva Mitra — Neon PostgreSQL schema (Better Auth + billing)
-- Run against Neon before deploy: psql $DATABASE_URL -f schema.postgres.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
  image TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  plan TEXT NOT NULL DEFAULT 'free',
  credits INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  token TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS accounts (
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
);

CREATE TABLE IF NOT EXISTS verifications (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS billing_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  razorpay_order_id TEXT NOT NULL UNIQUE,
  razorpay_payment_id TEXT,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  amount_paise INTEGER NOT NULL DEFAULT 9900,
  status TEXT NOT NULL DEFAULT 'captured',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sessions_userId_idx ON sessions ("userId");
CREATE INDEX IF NOT EXISTS accounts_userId_idx ON accounts ("userId");
CREATE INDEX IF NOT EXISTS verifications_identifier_idx ON verifications (identifier);
CREATE INDEX IF NOT EXISTS billing_events_user_id_idx ON billing_events (user_id);

CREATE TABLE IF NOT EXISTS guest_ai_quotas (
  subject_key TEXT NOT NULL,
  period_key TEXT NOT NULL,
  product TEXT NOT NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (subject_key, period_key, product)
);

CREATE TABLE IF NOT EXISTS career_ai_usage (
  subject_key TEXT NOT NULL,
  period_key TEXT NOT NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (subject_key, period_key)
);

CREATE TABLE IF NOT EXISTS munshi_partners (
  id TEXT PRIMARY KEY,
  munshi_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  upi_id TEXT,
  commission_share_bps INTEGER NOT NULL DEFAULT 3000,
  total_earned_paise BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  gstin TEXT,
  vertical TEXT NOT NULL,
  munshi_id TEXT REFERENCES munshi_partners (id),
  subscription_tier TEXT NOT NULL DEFAULT 'FREE',
  upi_mandate_id TEXT,
  preferred_locale TEXT NOT NULL DEFAULT 'en-IN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settlement_uploads (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenant_accounts (id),
  munshi_id TEXT REFERENCES munshi_partners (id),
  platform TEXT NOT NULL,
  vertical TEXT NOT NULL,
  file_hash TEXT,
  bank_utr TEXT,
  declared_net_payout_paise BIGINT,
  total_recoverable_paise BIGINT,
  unlock_fee_paise BIGINT,
  is_unlocked BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'PARSED',
  summary_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_finding_records (
  id TEXT PRIMARY KEY,
  upload_id TEXT NOT NULL REFERENCES settlement_uploads (id) ON DELETE CASCADE,
  order_id TEXT,
  order_item_id TEXT,
  sku TEXT,
  finding_type TEXT NOT NULL,
  deduction_bucket TEXT NOT NULL,
  expected_paise BIGINT NOT NULL,
  billed_paise BIGINT NOT NULL,
  recoverable_variance_paise BIGINT NOT NULL,
  source_tab_name TEXT,
  source_row_number INTEGER,
  claim_ticket_en TEXT,
  claim_ticket_hi TEXT,
  claim_status TEXT NOT NULL DEFAULT 'OPEN'
);

CREATE TABLE IF NOT EXISTS cell_verification_queue (
  id TEXT PRIMARY KEY,
  upload_id TEXT NOT NULL REFERENCES settlement_uploads (id) ON DELETE CASCADE,
  assigned_to_role TEXT NOT NULL CHECK (assigned_to_role IN ('MUNSHI', 'ADMIN')),
  row_number INTEGER NOT NULL,
  column_name TEXT NOT NULL,
  expected_paise BIGINT NOT NULL,
  extracted_paise BIGINT NOT NULL,
  crop_data_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
);

CREATE TABLE IF NOT EXISTS stateful_carry_forward_ledger (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenant_accounts (id),
  platform TEXT NOT NULL,
  source_tab_name TEXT,
  outstanding_paise BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS header_mapping_cache (
  id TEXT PRIMARY KEY,
  header_hash TEXT NOT NULL UNIQUE,
  platform TEXT,
  mapping_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS settlement_uploads_tenant_idx ON settlement_uploads (tenant_id);
CREATE INDEX IF NOT EXISTS audit_finding_records_upload_idx ON audit_finding_records (upload_id);
CREATE INDEX IF NOT EXISTS cell_verification_queue_upload_idx ON cell_verification_queue (upload_id);
