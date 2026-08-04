import { jsonResponse } from '../../_lib/json.mjs';
import { deductOperationCredits, requireProCredits } from '../../_lib/creditEconomy.mjs';
import { getRuntimeEnv } from '../../_lib/runtimeEnv.mjs';
import { getUserRow } from '../../_lib/userDb.mjs';
import {
  AI_CONVERT_OPERATION,
  buildAiConvertJobKey,
  parseAiConvertUpload,
  putAiConvertJob,
  runAiDocumentConversion,
} from '../../_lib/aiDocumentConvert.mjs';

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
      ...extra,
    },
    status,
  );
}

export async function onRequestPost(context) {
  const { request } = context;
  const env = getRuntimeEnv(context);

  const gate = await requireProCredits(request, context, AI_CONVERT_OPERATION);
  if (!gate.ok) {
    return jsonResponse(gate.body, gate.status);
  }

  const userRow = await getUserRow(env, gate.user.id);
  if (!userRow || userRow.plan !== 'pro') {
    return errorResponse(
      'PRO_REQUIRED',
      `Pro subscription required. Current plan: ${userRow?.plan ?? 'unknown'}.`,
      403,
    );
  }

  const apiKey = typeof env.GEMINI_API_KEY === 'string' ? env.GEMINI_API_KEY.trim() : '';
  if (!apiKey) {
    return errorResponse(
      'MISSING_API_KEY',
      'GEMINI_API_KEY is not configured for this environment.',
      503,
    );
  }

  let upload;
  try {
    upload = await parseAiConvertUpload(request);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return errorResponse('BAD_REQUEST', `Could not read upload: ${detail}`, 400);
  }

  if (upload.error) {
    return errorResponse(
      upload.errorCode || 'BAD_REQUEST',
      upload.error,
      upload.errorCode === 'PAYLOAD_TOO_LARGE' ? 413 : 400,
    );
  }

  if (!upload.mimeType) {
    return errorResponse(
      'BAD_MIME',
      `Unsupported file type "${upload.fileName}". Upload a PDF or image.`,
      400,
    );
  }

  const jobId = crypto.randomUUID();
  const jobKey = buildAiConvertJobKey(gate.user.id, jobId);
  const pendingJob = {
    jobId,
    userId: gate.user.id,
    status: 'pending',
    format: upload.format,
    sourceFileName: upload.fileName,
    createdAt: Date.now(),
  };

  const runJob = async () => {
    const processing = { ...pendingJob, status: 'processing', updatedAt: Date.now() };
    if (env.PRO_TRANSIENT) {
      await putAiConvertJob(env.PRO_TRANSIENT, jobKey, processing);
    }

    try {
      const result = await runAiDocumentConversion({
        apiKey,
        format: upload.format,
        mimeType: upload.mimeType,
        base64Data: upload.base64Data,
        fileName: upload.fileName,
      });

      const remainingCredits = await deductOperationCredits(
        env,
        gate.user.id,
        AI_CONVERT_OPERATION,
      );
      if (remainingCredits === null) {
        const failed = {
          ...processing,
          status: 'failed',
          error: 'Credit deduction failed after processing.',
          updatedAt: Date.now(),
        };
        if (env.PRO_TRANSIENT) {
          await putAiConvertJob(env.PRO_TRANSIENT, jobKey, failed);
        }
        return failed;
      }

      const completed = {
        ...processing,
        status: 'completed',
        format: result.format,
        fileName: result.fileName,
        html: result.html,
        rows: result.rows,
        model: result.model,
        remainingCredits,
        downloadUrl: `/api/ai/conversion-status?jobId=${encodeURIComponent(jobId)}`,
        updatedAt: Date.now(),
      };
      if (env.PRO_TRANSIENT) {
        await putAiConvertJob(env.PRO_TRANSIENT, jobKey, completed);
      }
      return completed;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const failed = {
        ...processing,
        status: 'failed',
        error: message || 'AI conversion failed.',
        updatedAt: Date.now(),
      };
      if (env.PRO_TRANSIENT) {
        await putAiConvertJob(env.PRO_TRANSIENT, jobKey, failed);
      }
      return failed;
    }
  };

  // Prefer async job + polling when R2 is available.
  if (env.PRO_TRANSIENT && typeof context.waitUntil === 'function') {
    await putAiConvertJob(env.PRO_TRANSIENT, jobKey, pendingJob);
    context.waitUntil(runJob());
    return jsonResponse({
      success: true,
      jobId,
      status: 'pending',
    });
  }

  // Sync fallback (local / missing R2): process inline and return completed payload.
  const completed = await runJob();
  if (completed.status === 'failed') {
    return errorResponse('CONVERSION_FAILED', completed.error || 'AI conversion failed.', 500, {
      jobId,
      status: 'failed',
    });
  }

  return jsonResponse({
    success: true,
    jobId,
    status: completed.status,
    format: completed.format,
    fileName: completed.fileName,
    html: completed.html,
    rows: completed.rows,
    downloadUrl: completed.downloadUrl,
    remainingCredits: completed.remainingCredits,
  });
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
