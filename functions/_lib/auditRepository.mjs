import { ensureNeonSchema } from './neonSchema.mjs';
import { getNeonSql } from './neonDb.mjs';
import { buildTaxAutopilotPackage } from './taxAutopilot.mjs';
import { runEcommerceAudit } from './ecommerceAuditor.mjs';
import { runRestaurantAudit } from './restaurantAuditor.mjs';
import { resolveCellVerification } from './selfHealingCrop.mjs';
import {
  applyFreemiumTeaserMask,
  buildCompliantUnlockCheckout,
  calculateMunshiCommission,
  processRejectedClaimRefund,
  totalRecoverablePaise,
} from './unlockEngine.mjs';

/** @type {Map<string, Record<string, unknown>>} */
const uploads = new Map();
/** @type {Map<string, { totalPaise: number, entries: Array<Record<string, unknown>> }>} */
const wallets = new Map();

/**
 * @param {string} prefix
 */
function newId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

/**
 * @param {Record<string, unknown>} env
 */
function sqlFor(env) {
  return getNeonSql(env || {});
}

/**
 * @param {Record<string, unknown>} record
 */
function remember(record) {
  uploads.set(String(record.id), record);
  return record;
}

/**
 * @param {import('@neondatabase/serverless').NeonQueryFunction} sql
 * @param {Record<string, unknown>} record
 */
async function writeNeon(sql, record) {
  await ensureNeonSchema(sql);
  const munshiId = record.munshiId ? String(record.munshiId) : null;
  if (munshiId) {
    await sql.query(
      `INSERT INTO munshi_partners (id, munshi_code, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [munshiId, munshiId, 'Munshi partner'],
    );
  }
  const tenantId = String(record.tenantId);
  await sql.query(
    `INSERT INTO tenant_accounts (id, name, vertical, munshi_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO NOTHING`,
    [tenantId, String(record.tenantName || 'Outlet'), String(record.vertical || 'RESTAURANT'), munshiId],
  );
  await sql.query(
    `INSERT INTO settlement_uploads (
       id, tenant_id, munshi_id, platform, vertical, declared_net_payout_paise,
       total_recoverable_paise, unlock_fee_paise, is_unlocked, status, summary_json
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PARSED', $10::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       total_recoverable_paise = EXCLUDED.total_recoverable_paise,
       unlock_fee_paise = EXCLUDED.unlock_fee_paise,
       is_unlocked = EXCLUDED.is_unlocked,
       summary_json = EXCLUDED.summary_json`,
    [
      record.id,
      tenantId,
      munshiId,
      String(record.platform || 'UNKNOWN'),
      String(record.vertical || 'RESTAURANT'),
      Number(record.declaredNetPayoutPaise || 0),
      Number(record.totalRecoverablePaise || 0),
      Number(record.quotedUnlockFeePaise || 0),
      record.isUnlocked === true,
      JSON.stringify(record),
    ],
  );
}

/**
 * @param {Record<string, unknown>} env
 * @param {Record<string, unknown>} record
 */
async function persist(env, record) {
  remember(record);
  const sql = sqlFor(env);
  if (!sql) return { storage: 'memory', record };
  try {
    await writeNeon(sql, record);
    return { storage: 'neon', record };
  } catch (err) {
    console.error('[audit] Neon save failed', err instanceof Error ? err.message : err);
    return { storage: 'memory', record };
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} uploadId
 */
export async function getAuditUpload(env, uploadId) {
  const cached = uploads.get(uploadId);
  if (cached) return cached;
  const sql = sqlFor(env);
  if (!sql) return null;
  try {
    const rows = await sql.query('SELECT summary_json FROM settlement_uploads WHERE id = $1 LIMIT 1', [uploadId]);
    const raw = rows?.[0]?.summary_json;
    if (!raw) return null;
    const record = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return remember(record);
  } catch (err) {
    console.error('[audit] Neon read failed', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * @param {Record<string, unknown>} statement
 * @param {Record<string, unknown>} [contract]
 * @param {Record<string, unknown>} [options]
 */
function runAudit(statement, contract = {}, options = {}) {
  return statement?.vertical === 'ECOMMERCE'
    ? runEcommerceAudit(statement, contract, options)
    : runRestaurantAudit(statement, contract, options);
}

/**
 * @param {Record<string, unknown>} env
 * @param {Record<string, unknown>} body
 */
export async function createAuditUpload(env, body) {
  const statement = body?.statement;
  if (!statement || typeof statement !== 'object') {
    const error = new Error('A statement is required.');
    error.code = 'STATEMENT_REQUIRED';
    throw error;
  }
  const contract = body.contract && typeof body.contract === 'object' ? body.contract : {};
  const options = body.options && typeof body.options === 'object' ? body.options : {};
  const auditResult = runAudit(statement, contract, options);
  const taxPackage = buildTaxAutopilotPackage(statement, auditResult);
  const masked = applyFreemiumTeaserMask(auditResult, {
    isPro: body.isPro === true,
    forceUnlocked: body.forceUnlocked === true,
  });
  const record = remember({
    id: newId('upl'),
    tenantId: String(body.tenantId || 'tenant_local'),
    tenantName: String(body.tenantName || statement.outletName || 'Outlet'),
    munshiId: body.munshiId ? String(body.munshiId) : null,
    platform: String(statement.platform || 'UNKNOWN'),
    vertical: String(statement.vertical || 'RESTAURANT'),
    declaredNetPayoutPaise: Number(statement.declaredSummaryNetPayoutPaise || statement.declaredNetPayoutPaise || 0),
    statement,
    contract,
    auditResult,
    taxPackage,
    totalRecoverablePaise: masked.totalRecoverablePaise,
    quotedUnlockFeePaise: masked.unlockFeePaise,
    ownerPocketPaise: masked.ownerPocketPaise,
    isUnlocked: masked.isUnlocked === true,
    verificationQueue: Array.isArray(body.verificationQueue) ? body.verificationQueue : [],
    createdAt: new Date().toISOString(),
  });
  const saved = await persist(env, record);
  return { storage: saved.storage, uploadId: record.id, audit: masked, taxPackage, quotedUnlockFeePaise: record.quotedUnlockFeePaise };
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} uploadId
 * @param {'TRUST_CLOCK_MANDATE' | 'ONE_TAP_UPI' | 'PRO_299'} mode
 */
export async function createUnlockCheckout(env, uploadId, mode) {
  const upload = await getAuditUpload(env, uploadId);
  if (!upload) {
    const error = new Error('That audit was not found.');
    error.code = 'NOT_FOUND';
    throw error;
  }
  const fee = mode === 'PRO_299' ? 29900 : Number(upload.quotedUnlockFeePaise || 0);
  const checkout = buildCompliantUnlockCheckout(uploadId, fee, mode);
  return { checkout, razorpayConfigured: false };
}

/**
 * @param {string | null} munshiId
 * @param {number} revenuePaise
 * @param {string} source
 */
function creditWallet(munshiId, revenuePaise, source) {
  if (!munshiId || revenuePaise <= 0) return 0;
  const commissionPaise = calculateMunshiCommission(revenuePaise);
  const wallet = wallets.get(munshiId) || { totalPaise: 0, entries: [] };
  wallet.totalPaise += commissionPaise;
  wallet.entries.push({ revenuePaise, commissionPaise, source, at: new Date().toISOString() });
  wallets.set(munshiId, wallet);
  return commissionPaise;
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} uploadId
 */
export async function unlockAudit(env, uploadId) {
  const upload = await getAuditUpload(env, uploadId);
  if (!upload) {
    const error = new Error('That audit was not found.');
    error.code = 'NOT_FOUND';
    throw error;
  }
  const already = upload.isUnlocked === true;
  upload.isUnlocked = true;
  const commissionPaise = already ? 0 : creditWallet(upload.munshiId ? String(upload.munshiId) : null, Number(upload.quotedUnlockFeePaise || 0), 'claim_unlock');
  const saved = await persist(env, upload);
  return {
    storage: saved.storage,
    uploadId,
    commissionPaise,
    audit: applyFreemiumTeaserMask(upload.auditResult, { forceUnlocked: true }),
    taxPackage: upload.taxPackage,
  };
}

/**
 * @param {Record<string, unknown>} env
 * @param {Record<string, unknown>} body
 */
export async function resolveStoredCell(env, body) {
  const upload = await getAuditUpload(env, String(body.uploadId || ''));
  if (!upload) {
    const error = new Error('That audit was not found.');
    error.code = 'NOT_FOUND';
    throw error;
  }
  const healed = resolveCellVerification(
    upload.statement,
    body.queueItem || {},
    body.correctedValue,
    upload.contract || {},
    {},
  );
  upload.statement = healed.statement;
  upload.auditResult = healed.auditResult;
  upload.taxPackage = buildTaxAutopilotPackage(healed.statement, healed.auditResult || {});
  upload.totalRecoverablePaise = totalRecoverablePaise(upload.auditResult);
  upload.verificationQueue = (upload.verificationQueue || []).map((item) =>
    item.orderId === healed.queueItem?.orderId && item.columnName === healed.queueItem?.columnName ? healed.queueItem : item,
  );
  const saved = await persist(env, upload);
  return {
    storage: saved.storage,
    horizontalGapPaise: healed.horizontalGapPaise,
    queueItem: healed.queueItem,
    audit: applyFreemiumTeaserMask(upload.auditResult, { forceUnlocked: upload.isUnlocked === true }),
    taxPackage: upload.taxPackage,
  };
}

/**
 * @param {Record<string, unknown>} env
 * @param {Record<string, unknown>} body
 */
export async function rejectStoredClaim(env, body) {
  const upload = await getAuditUpload(env, String(body.uploadId || ''));
  if (!upload) {
    const error = new Error('That audit was not found.');
    error.code = 'NOT_FOUND';
    throw error;
  }
  const findings = Array.isArray(upload.auditResult?.findings) ? upload.auditResult.findings : [];
  const finding = findings.find((item) => item.orderId === body.orderId || item.id === body.findingId);
  if (!finding) {
    const error = new Error('That finding was not found.');
    error.code = 'NOT_FOUND';
    throw error;
  }
  const refund = processRejectedClaimRefund(
    finding,
    Number(upload.quotedUnlockFeePaise || 0),
    totalRecoverablePaise(upload.auditResult),
    body.rejectionTicketId,
  );
  const saved = await persist(env, upload);
  return { storage: saved.storage, ...refund };
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} munshiId
 */
export async function munshiDashboard(env, munshiId) {
  const id = String(munshiId || '');
  const clients = [...uploads.values()].filter((upload) => String(upload.munshiId || '') === id);
  const wallet = wallets.get(id) || { totalPaise: 0, entries: [] };
  const pendingCellChecks = clients.flatMap((upload) =>
    (Array.isArray(upload.verificationQueue) ? upload.verificationQueue : []).filter((item) => item.status !== 'RESOLVED'),
  );
  return {
    munshiId: id,
    commissionShareBps: 3000,
    commissionWalletPaise: wallet.totalPaise,
    entries: wallet.entries,
    clients: clients.map((upload) => ({
      uploadId: upload.id,
      platform: upload.platform,
      totalRecoverablePaise: upload.totalRecoverablePaise,
      quotedUnlockFeePaise: upload.quotedUnlockFeePaise,
      isUnlocked: upload.isUnlocked === true,
    })),
    pendingCellChecks,
    storage: sqlFor(env) ? 'neon-or-memory' : 'memory',
  };
}

/**
 * Test helper. Production requests do not call this.
 */
export function resetAuditMemory() {
  uploads.clear();
  wallets.clear();
}
