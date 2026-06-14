/**
 * Ephemeral Pro document storage helpers (Cloudflare R2).
 */

const SAFE_FILENAME = /[^a-zA-Z0-9._-]+/g;

export function sanitizeProFilename(name) {
  const base = (name || 'document').trim().slice(0, 180) || 'document';
  return base.replace(SAFE_FILENAME, '_');
}

export function buildProObjectKey(userId, fileName) {
  return `pro/${userId}/${crypto.randomUUID()}/${sanitizeProFilename(fileName)}`;
}

export function assertProObjectKeyForUser(objectKey, userId) {
  if (typeof objectKey !== 'string' || !objectKey.startsWith(`pro/${userId}/`)) {
    return false;
  }
  if (objectKey.includes('..') || objectKey.includes('\\')) {
    return false;
  }
  return true;
}

export const PRO_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

export const MOCK_EXTRACT_CSV = 'Date,Description,Amount\n2026-06-14,Test Extraction,199.00';

export const MOCK_EXTRACT_DELAY_MS = 3000;
