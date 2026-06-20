import { jsonResponse } from '../../_lib/json.mjs';
import { readEnvString, getRuntimeEnv } from '../../_lib/runtimeEnv.mjs';
import {
  DEFAULT_SES_FROM_EMAIL,
  getSesConfigDiagnostics,
  sendSesTestEmail,
} from '../../_lib/sesMail.mjs';

const DEFAULT_TEST_TO = DEFAULT_SES_FROM_EMAIL;

/**
 * @param {Request} request
 * @param {Record<string, unknown>} env
 */
function isAuthorized(request, env) {
  const authHeader = request.headers.get('Authorization') ?? '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  const testSecret = readEnvString(env, 'SES_TEST_SECRET');
  const authSecret = readEnvString(env, 'BETTER_AUTH_SECRET');

  if (testSecret && bearer === testSecret) return true;
  if (authSecret && bearer === authSecret) return true;

  return false;
}

export async function onRequestGet(context) {
  const env = getRuntimeEnv(context);
  if (!isAuthorized(context.request, env)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  return jsonResponse({
    ok: true,
    diagnostics: getSesConfigDiagnostics(env),
    defaultTestRecipient: DEFAULT_TEST_TO,
    usage: {
      method: 'POST',
      authorization: 'Bearer <SES_TEST_SECRET or BETTER_AUTH_SECRET>',
      body: { to: DEFAULT_TEST_TO },
    },
  });
}

export async function onRequestPost(context) {
  const { request } = context;
  const env = getRuntimeEnv(context);

  if (!isAuthorized(request, env)) {
    return jsonResponse({ error: 'Unauthorized — send Authorization: Bearer <SES_TEST_SECRET or BETTER_AUTH_SECRET>' }, 401);
  }

  const diagnostics = getSesConfigDiagnostics(env);
  if (!diagnostics.configured) {
    return jsonResponse(
      {
        error: 'SES is not fully configured',
        diagnostics,
      },
      503,
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    /* optional JSON body */
  }

  const to =
    typeof body.to === 'string' && body.to.includes('@') ? body.to.trim() : DEFAULT_TEST_TO;

  try {
    const result = await sendSesTestEmail(env, { to });

    if (!result.ok) {
      return jsonResponse(
        {
          error: 'Email was not sent',
          reason: result.reason ?? 'unknown',
          diagnostics: result.diagnostics ?? diagnostics,
        },
        503,
      );
    }

    return jsonResponse({
      success: true,
      message: `Test email sent to ${to}`,
      messageId: result.messageId,
      from: result.from,
      region: result.region,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = err instanceof Error && 'code' in err ? err.code : undefined;
    const detail = err instanceof Error && 'detail' in err ? err.detail : undefined;

    if (code === 'SES_SANDBOX_ERROR') {
      return jsonResponse(
        {
          code: 'SES_SANDBOX_ERROR',
          error: message,
          hint: `In sandbox mode both sender and recipient must be verified in SES (${diagnostics.region}).`,
          detail,
        },
        403,
      );
    }

    console.error('[admin/ses-test] Send failed:', message, detail);
    return jsonResponse({ error: message, detail }, 500);
  }
}

export async function onRequest(context) {
  if (context.request.method === 'GET') {
    return onRequestGet(context);
  }
  if (context.request.method === 'POST') {
    return onRequestPost(context);
  }
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
