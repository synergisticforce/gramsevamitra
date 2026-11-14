/**
 * Payout-audit tables. Created with IF NOT EXISTS so a repeat call is safe.
 * Wired into ensureNeonSchema so the first audit or AI request prepares Neon.
 */

export const AUDIT_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS munshi_partners (
    id TEXT PRIMARY KEY,
    munshi_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    upi_id TEXT,
    commission_share_bps INTEGER NOT NULL DEFAULT 3000,
    total_earned_paise BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS tenant_accounts (
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
  )`,
  `CREATE TABLE IF NOT EXISTS settlement_uploads (
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
  )`,
  `CREATE TABLE IF NOT EXISTS audit_finding_records (
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
  )`,
  `CREATE TABLE IF NOT EXISTS cell_verification_queue (
    id TEXT PRIMARY KEY,
    upload_id TEXT NOT NULL REFERENCES settlement_uploads (id) ON DELETE CASCADE,
    assigned_to_role TEXT NOT NULL CHECK (assigned_to_role IN ('MUNSHI', 'ADMIN')),
    row_number INTEGER NOT NULL,
    column_name TEXT NOT NULL,
    expected_paise BIGINT NOT NULL,
    extracted_paise BIGINT NOT NULL,
    crop_data_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING'
  )`,
  `CREATE TABLE IF NOT EXISTS stateful_carry_forward_ledger (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenant_accounts (id),
    platform TEXT NOT NULL,
    source_tab_name TEXT,
    outstanding_paise BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS header_mapping_cache (
    id TEXT PRIMARY KEY,
    header_hash TEXT NOT NULL UNIQUE,
    platform TEXT,
    mapping_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS munshi_payout_requests (
    id TEXT PRIMARY KEY,
    munshi_code TEXT NOT NULL,
    upi_id TEXT NOT NULL,
    amount_paise BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'REQUESTED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS settlement_uploads_tenant_idx ON settlement_uploads (tenant_id)`,
  `CREATE INDEX IF NOT EXISTS munshi_payout_requests_status_idx ON munshi_payout_requests (status)`,
  `CREATE INDEX IF NOT EXISTS audit_finding_records_upload_idx ON audit_finding_records (upload_id)`,
  `CREATE INDEX IF NOT EXISTS cell_verification_queue_upload_idx ON cell_verification_queue (upload_id)`,
];

/**
 * @param {{ query: (statement: string) => Promise<unknown> }} sql
 */
export async function ensureAuditTables(sql) {
  for (const statement of AUDIT_SCHEMA_STATEMENTS) {
    await sql.query(statement);
  }
}
