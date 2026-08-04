/**
 * Async AI document conversion jobs stored in PRO_TRANSIENT (R2).
 */

import {
  DOCUMENT_OCR_MAX_BYTES,
  bytesToBase64,
  resolveDocumentOcrMime,
  runGeminiDocumentLayoutHtml,
  runGeminiDocumentTableJson,
} from './geminiDocumentOcr.mjs';

export const AI_CONVERT_FORMATS = new Set(['docx', 'xlsx', 'csv']);
export const AI_CONVERT_OPERATION = 'reconstruct-layout';

/**
 * @param {string} userId
 * @param {string} jobId
 */
export function buildAiConvertJobKey(userId, jobId) {
  return `ai-jobs/${userId}/${jobId}.json`;
}

/**
 * @param {string} userId
 * @param {string} jobId
 */
export function assertAiConvertJobKeyForUser(objectKey, userId) {
  if (typeof objectKey !== 'string') return false;
  return objectKey.startsWith(`ai-jobs/${userId}/`) && objectKey.endsWith('.json');
}

/**
 * @param {Request} request
 */
export async function parseAiConvertUpload(request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('file');
    const formatRaw = form.get('format');
    const format =
      typeof formatRaw === 'string' ? formatRaw.trim().toLowerCase() : 'docx';

    if (!(file instanceof File)) {
      return { error: 'Attach a PDF or image as form field "file".', errorCode: 'BAD_REQUEST' };
    }
    if (file.size <= 0) {
      return { error: 'The uploaded file is empty.', errorCode: 'EMPTY_FILE' };
    }
    if (file.size > DOCUMENT_OCR_MAX_BYTES) {
      return {
        error: `File is too large (max ${Math.floor(DOCUMENT_OCR_MAX_BYTES / (1024 * 1024))} MB).`,
        errorCode: 'PAYLOAD_TOO_LARGE',
      };
    }
    if (!AI_CONVERT_FORMATS.has(format)) {
      return { error: 'format must be docx, xlsx, or csv.', errorCode: 'BAD_FORMAT' };
    }

    const buffer = await file.arrayBuffer();
    return {
      format,
      fileName: file.name || 'document',
      mimeType: resolveDocumentOcrMime(file.type, file.name),
      base64Data: bytesToBase64(buffer),
      byteLength: buffer.byteLength,
    };
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return {
      error: 'Send multipart form data or JSON with fileBase64 + format.',
      errorCode: 'BAD_REQUEST',
    };
  }

  const format =
    typeof body.format === 'string' ? body.format.trim().toLowerCase() : 'docx';
  if (!AI_CONVERT_FORMATS.has(format)) {
    return { error: 'format must be docx, xlsx, or csv.', errorCode: 'BAD_FORMAT' };
  }

  const fileName =
    typeof body.fileName === 'string' && body.fileName.trim()
      ? body.fileName.trim().slice(0, 200)
      : 'document';
  let base64Data = typeof body.fileBase64 === 'string' ? body.fileBase64.trim() : '';
  if (base64Data.includes(',')) {
    base64Data = base64Data.slice(base64Data.indexOf(',') + 1);
  }
  if (!base64Data) {
    return { error: 'JSON body must include fileBase64.', errorCode: 'BAD_PAYLOAD' };
  }

  const approxBytes = Math.floor((base64Data.length * 3) / 4);
  if (approxBytes > DOCUMENT_OCR_MAX_BYTES) {
    return {
      error: `File is too large (max ${Math.floor(DOCUMENT_OCR_MAX_BYTES / (1024 * 1024))} MB).`,
      errorCode: 'PAYLOAD_TOO_LARGE',
    };
  }

  return {
    format,
    fileName,
    mimeType: resolveDocumentOcrMime(
      typeof body.mimeType === 'string' ? body.mimeType : '',
      fileName,
    ),
    base64Data,
    byteLength: approxBytes,
  };
}

/**
 * @param {{
 *   apiKey: string;
 *   format: 'docx' | 'xlsx' | 'csv';
 *   mimeType: string;
 *   base64Data: string;
 *   fileName: string;
 * }} input
 */
export async function runAiDocumentConversion(input) {
  const baseName = input.fileName.replace(/\.[^.]+$/, '') || 'document';

  if (input.format === 'docx') {
    const result = await runGeminiDocumentLayoutHtml({
      apiKey: input.apiKey,
      mimeType: input.mimeType,
      base64Data: input.base64Data,
      fileName: input.fileName,
    });
    return {
      format: 'docx',
      fileName: `${baseName}.docx`,
      html: result.html,
      model: result.model,
    };
  }

  const result = await runGeminiDocumentTableJson({
    apiKey: input.apiKey,
    mimeType: input.mimeType,
    base64Data: input.base64Data,
    fileName: input.fileName,
  });

  return {
    format: input.format,
    fileName: `${baseName}.${input.format}`,
    rows: result.rows,
    model: result.model,
  };
}

/**
 * @param {R2Bucket} bucket
 * @param {string} key
 * @param {Record<string, unknown>} job
 */
export async function putAiConvertJob(bucket, key, job) {
  await bucket.put(key, JSON.stringify(job), {
    httpMetadata: { contentType: 'application/json' },
    customMetadata: {
      status: String(job.status ?? ''),
      userId: String(job.userId ?? ''),
    },
  });
}

/**
 * @param {R2Bucket} bucket
 * @param {string} key
 */
export async function getAiConvertJob(bucket, key) {
  const object = await bucket.get(key);
  if (!object) return null;
  try {
    return await object.json();
  } catch {
    return null;
  }
}
