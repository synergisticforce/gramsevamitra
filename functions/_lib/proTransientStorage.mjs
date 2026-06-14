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

/** Media Lab transient uploads: pro/{userId}/media/{uuid}/{filename} */
export function buildProMediaObjectKey(userId, fileName) {
  return `pro/${userId}/media/${crypto.randomUUID()}/${sanitizeProFilename(fileName)}`;
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

export function assertProMediaObjectKeyForUser(objectKey, userId) {
  if (!assertProObjectKeyForUser(objectKey, userId)) {
    return false;
  }
  return objectKey.startsWith(`pro/${userId}/media/`);
}

export const PRO_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

export const MOCK_EXTRACT_CSV = 'Date,Description,Amount\n2026-06-14,Test Extraction,199.00';

export const MOCK_EXTRACT_DELAY_MS = 3000;

export const MOCK_MEDIA_DELAY_MS = 3000;

export const MEDIA_PRO_ACTIONS = new Set(['remove-bg', 'upscale']);
