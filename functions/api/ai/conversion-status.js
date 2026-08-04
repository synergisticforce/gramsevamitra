import { jsonResponse } from '../../_lib/json.mjs';
import { getRuntimeEnv } from '../../_lib/runtimeEnv.mjs';
import { getSessionUser } from '../../_lib/session.mjs';
import {
  buildAiConvertJobKey,
  getAiConvertJob,
} from '../../_lib/aiDocumentConvert.mjs';

export async function onRequestGet(context) {
  const { request } = context;
  const env = getRuntimeEnv(context);
  const user = await getSessionUser(request, context);

  if (!user?.id) {
    return jsonResponse({ error: 'Sign in required.', code: 'AUTH_REQUIRED' }, 401);
  }

  if (user.plan !== 'pro') {
    return jsonResponse({ error: 'Pro subscription required.', code: 'PRO_REQUIRED' }, 403);
  }

  const url = new URL(request.url);
  const jobId = url.searchParams.get('jobId');
  if (!jobId) {
    return jsonResponse({ error: 'Missing jobId query parameter.', code: 'INVALID_PAYLOAD' }, 400);
  }

  if (!env.PRO_TRANSIENT) {
    return jsonResponse(
      {
        jobId,
        status: 'failed',
        error: 'Transient storage is not configured; restart conversion.',
      },
      503,
    );
  }

  const key = buildAiConvertJobKey(user.id, jobId);
  const job = await getAiConvertJob(env.PRO_TRANSIENT, key);
  if (!job || job.userId !== user.id) {
    return jsonResponse({ error: 'Conversion job not found.', code: 'NOT_FOUND' }, 404);
  }

  return jsonResponse({
    jobId: job.jobId,
    status: job.status,
    downloadUrl: job.downloadUrl,
    error: job.error,
    format: job.format,
    fileName: job.fileName,
    html: job.html,
    rows: job.rows,
    remainingCredits: job.remainingCredits,
  });
}

export async function onRequest(context) {
  if (context.request.method === 'GET') {
    return onRequestGet(context);
  }
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
