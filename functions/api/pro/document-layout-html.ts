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
 * @param {Request} request
 */
async function parseDocumentPayload(request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return { error: 'Attach a PDF or image as form field "file".' };
    }
    if (file.size <= 0) {
      return { error: 'The uploaded file is empty.' };
    }
    if (file.size > DOCUMENT_OCR_MAX_BYTES) {
      return {
        error: `File is too large for Vision AI (max ${Math.floor(DOCUMENT_OCR_MAX_BYTES / (1024 * 1024))} MB).`,
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
    return { error: 'Send multipart form data or a JSON body.' };
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
    return { error: 'JSON body must include fileBase64.' };
  }

  const approxBytes = Math.floor((base64Data.length * 3) / 4);
  if (approxBytes > DOCUMENT_OCR_MAX_BYTES) {
    return {
      error: `File is too large for Vision AI (max ${Math.floor(DOCUMENT_OCR_MAX_BYTES / (1024 * 1024))} MB).`,
    };
  }

  return {
    fileName,
    mimeType,
    base64Data,
    byteLength: approxBytes,
  };
}

export async function onRequestPost(context) {
  const { request } = context;
  const env = getRuntimeEnv(context);

  const gate = await requireProCredits(request, context, OPERATION_ID);
  if (!gate.ok) {
    return jsonResponse(gate.body, gate.status);
  }

  const userRow = await getUserRow(env, gate.user.id);
  if (!userRow || userRow.plan !== 'pro') {
    return jsonResponse(
      { error: 'Forbidden', message: 'Pro subscription required.' },
      403,
    );
  }

  const credits =
    typeof userRow.credits === 'number' ? userRow.credits : Number(userRow.credits ?? 0);
  if (!(credits > 0) || credits < gate.cost) {
    return jsonResponse(
      {
        error: 'Payment Required',
        message: `Insufficient AI Credits. This operation requires ${gate.cost}; you have ${credits}.`,
        operationId: OPERATION_ID,
        requiredCredits: gate.cost,
        remainingCredits: credits,
      },
      402,
    );
  }

  const apiKey =
    typeof env.GEMINI_API_KEY === 'string' ? env.GEMINI_API_KEY.trim() : '';
  if (!apiKey) {
    return jsonResponse(
      {
        error: 'Service Unavailable',
        message: 'Vision AI is not configured. Set GEMINI_API_KEY in Cloudflare Pages secrets.',
      },
      503,
    );
  }

  let payload;
  try {
    payload = await parseDocumentPayload(request);
  } catch (err) {
    console.error('[document-layout-html] Failed to parse upload:', err);
    return jsonResponse({ error: 'Bad Request', message: 'Could not read the uploaded file.' }, 400);
  }

  if (payload.error) {
    return jsonResponse({ error: 'Bad Request', message: payload.error }, 400);
  }

  if (!payload.mimeType) {
    return jsonResponse(
      { error: 'Bad Request', message: 'Upload a PDF or image (JPG, PNG, WEBP).' },
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
      return jsonResponse(
        {
          error: 'Payment Required',
          message: 'Credit deduction failed after processing.',
          requiredCredits: gate.cost,
        },
        402,
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
    const code = err && typeof err === 'object' ? err.code : undefined;
    if (code === 'BAD_MIME' || code === 'BAD_PAYLOAD' || code === 'EMPTY') {
      return jsonResponse(
        { error: 'Bad Request', message: err.message || 'Layout reconstruction failed.' },
        400,
      );
    }
    if (code === 'CONFIG') {
      return jsonResponse(
        { error: 'Service Unavailable', message: err.message || 'Vision AI is not configured.' },
        503,
      );
    }
    return jsonResponse(
      {
        error: 'Internal Server Error',
        message: 'Vision AI could not reconstruct this layout. Please try again.',
      },
      500,
    );
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
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
