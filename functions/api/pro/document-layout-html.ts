/**
 * POST /api/pro/document-layout-html
 * Gemini Vision → layout-preserving HTML for client-side DOCX generation.
 *
 * Auth: Better Auth session + users.plan === 'pro' + AI Credits (reconstruct-layout).
 * Secret: GEMINI_API_KEY
 */

import { jsonResponse } from '../../_lib/json.mjs';
import { deductOperationCredits, requireProCredits } from '../../_lib/creditEconomy.mjs';
import { getRuntimeEnv } from '../../_lib/runtimeEnv.mjs';
import { getUserRow } from '../../_lib/userDb.mjs';
import {
  DOCUMENT_OCR_MAX_BYTES,
  DOCUMENT_OCR_MODEL,
  bytesToBase64,
  resolveDocumentOcrMime,
  runGeminiDocumentLayoutHtml,
} from '../../_lib/geminiDocumentOcr.mjs';

const OPERATION_ID = 'reconstruct-layout';

/**
 * @param {string} code
 * @param {string} message
 * @param {number} status
 * @param {Record<string, unknown>} [extra]
 */
function errorResponse(code, message, status, extra = {}) {
  return jsonResponse(
    {
      success: false,
      error: code,
      code,
      message,
      detail: message,
      ...extra,
    },
    status,
  );
}

/**
 * @param {Request} request
 */
async function parseDocumentPayload(request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return { errorCode: 'BAD_REQUEST', error: 'Attach a PDF or image as form field "file".' };
    }
    if (file.size <= 0) {
      return { errorCode: 'EMPTY_FILE', error: 'The uploaded file is empty.' };
    }
    if (file.size > DOCUMENT_OCR_MAX_BYTES) {
      return {
        errorCode: 'PAYLOAD_TOO_LARGE',
        error: `Payload too large: file is ${Math.round(file.size / (1024 * 1024))} MB (max ${Math.floor(DOCUMENT_OCR_MAX_BYTES / (1024 * 1024))} MB for Vision AI).`,
      };
    }
    const buffer = await file.arrayBuffer();
    return {
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
      errorCode: 'BAD_REQUEST',
      error: 'Send multipart form data or a JSON body with fileBase64.',
    };
  }

  const fileName =
    typeof body.fileName === 'string' && body.fileName.trim()
      ? body.fileName.trim().slice(0, 200)
      : 'document';
  const mimeType = resolveDocumentOcrMime(
    typeof body.mimeType === 'string' ? body.mimeType : '',
    fileName,
  );
  let base64Data = typeof body.fileBase64 === 'string' ? body.fileBase64.trim() : '';
  if (base64Data.includes(',')) {
    base64Data = base64Data.slice(base64Data.indexOf(',') + 1);
  }

  if (!base64Data) {
    return { errorCode: 'BAD_PAYLOAD', error: 'JSON body must include fileBase64.' };
  }

  const approxBytes = Math.floor((base64Data.length * 3) / 4);
  if (approxBytes > DOCUMENT_OCR_MAX_BYTES) {
    return {
      errorCode: 'PAYLOAD_TOO_LARGE',
      error: `Payload too large: ~${Math.round(approxBytes / (1024 * 1024))} MB (max ${Math.floor(DOCUMENT_OCR_MAX_BYTES / (1024 * 1024))} MB for Vision AI).`,
    };
  }

  return {
    fileName,
    mimeType,
    base64Data,
    byteLength: approxBytes,
  };
}

/**
 * @param {unknown} err
 */
function mapCaughtError(err) {
  const code =
    err && typeof err === 'object' && 'code' in err && typeof err.code === 'string'
      ? err.code
      : 'GEMINI';
  const message =
    err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
      ? err.message
      : String(err ?? 'Unknown layout reconstruction error');

  switch (code) {
    case 'CONFIG':
    case 'API_KEY':
      return {
        status: 503,
        code: 'MISSING_API_KEY',
        message: message.includes('GEMINI_API_KEY')
          ? message
          : `Missing or invalid GEMINI_API_KEY: ${message}`,
      };
    case 'TIMEOUT':
      return { status: 504, code: 'GEMINI_TIMEOUT', message };
    case 'PAYLOAD_TOO_LARGE':
      return { status: 413, code: 'PAYLOAD_TOO_LARGE', message };
    case 'RATE_LIMIT':
      return { status: 429, code: 'RATE_LIMIT', message };
    case 'BAD_MIME':
    case 'BAD_PAYLOAD':
    case 'EMPTY':
      return { status: 400, code, message };
    default:
      return {
        status: 500,
        code: code || 'GEMINI',
        message: message || 'Gemini API error during layout reconstruction.',
      };
  }
}

export async function onRequestPost(context) {
  const { request } = context;
  const env = getRuntimeEnv(context);

  const gate = await requireProCredits(request, context, OPERATION_ID);
  if (!gate.ok) {
    const gateMessage =
      typeof gate.body?.message === 'string'
        ? gate.body.message
        : gate.status === 401
          ? 'Sign in required.'
          : gate.status === 402
            ? 'Insufficient AI Credits for layout reconstruction.'
            : gate.status === 403
              ? 'Pro subscription required (users.plan must be "pro").'
              : 'Authorization failed for layout reconstruction.';
    return errorResponse(
      gate.status === 402
        ? 'INSUFFICIENT_CREDITS'
        : gate.status === 401
          ? 'UNAUTHORIZED'
          : gate.status === 403
            ? 'PRO_REQUIRED'
            : 'AUTH_FAILED',
      gateMessage,
      gate.status,
      {
        ...(gate.body && typeof gate.body === 'object' ? gate.body : {}),
        message: gateMessage,
      },
    );
  }

  const userRow = await getUserRow(env, gate.user.id);
  if (!userRow || userRow.plan !== 'pro') {
    return errorResponse(
      'PRO_REQUIRED',
      `Pro subscription required. Current plan: ${userRow?.plan ?? 'unknown'} (expected "pro").`,
      403,
    );
  }

  const credits =
    typeof userRow.credits === 'number' ? userRow.credits : Number(userRow.credits ?? 0);
  if (!(credits > 0) || credits < gate.cost) {
    return errorResponse(
      'INSUFFICIENT_CREDITS',
      `Insufficient AI Credits. This operation requires ${gate.cost}; you have ${credits}.`,
      402,
      {
        operationId: OPERATION_ID,
        requiredCredits: gate.cost,
        remainingCredits: credits,
      },
    );
  }

  const apiKey =
    typeof env.GEMINI_API_KEY === 'string' ? env.GEMINI_API_KEY.trim() : '';
  if (!apiKey) {
    return errorResponse(
      'MISSING_API_KEY',
      'Missing API Key: GEMINI_API_KEY is not set in Cloudflare Pages secrets for this environment.',
      503,
    );
  }

  let payload;
  try {
    payload = await parseDocumentPayload(request);
  } catch (err) {
    console.error('[document-layout-html] Failed to parse upload:', err);
    const detail = err instanceof Error ? err.message : String(err);
    return errorResponse(
      'BAD_REQUEST',
      `Could not read the uploaded file: ${detail}`,
      400,
    );
  }

  if (payload.error) {
    return errorResponse(
      payload.errorCode || 'BAD_REQUEST',
      payload.error,
      payload.errorCode === 'PAYLOAD_TOO_LARGE' ? 413 : 400,
    );
  }

  if (!payload.mimeType) {
    return errorResponse(
      'BAD_MIME',
      `Unsupported file type "${payload.fileName}". Upload a PDF or image (JPG, PNG, WEBP).`,
      400,
    );
  }

  const started = Date.now();

  try {
    const result = await runGeminiDocumentLayoutHtml({
      apiKey,
      mimeType: payload.mimeType,
      base64Data: payload.base64Data,
      fileName: payload.fileName,
    });

    const remainingCredits = await deductOperationCredits(env, gate.user.id, OPERATION_ID);
    if (remainingCredits === null) {
      return errorResponse(
        'INSUFFICIENT_CREDITS',
        `Credit deduction failed after processing (required ${gate.cost}).`,
        402,
        { requiredCredits: gate.cost },
      );
    }

    return jsonResponse({
      success: true,
      format: 'html',
      html: result.html,
      model: result.model || DOCUMENT_OCR_MODEL,
      fileName: payload.fileName,
      mimeType: result.mimeType,
      byteLength: payload.byteLength,
      processingMs: Date.now() - started,
      creditsUsed: gate.cost,
      remainingCredits,
    });
  } catch (err) {
    console.error('[document-layout-html] Gemini layout failed:', err);
    const mapped = mapCaughtError(err);
    return errorResponse(mapped.code, mapped.message, mapped.status, {
      processingMs: Date.now() - started,
    });
  }
}

export async function onRequest(context) {
  if (context.request.method === 'POST') {
    return onRequestPost(context);
  }
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { Allow: 'POST, OPTIONS' },
    });
  }
  return errorResponse('METHOD_NOT_ALLOWED', 'Method Not Allowed. Use POST.', 405);
}
