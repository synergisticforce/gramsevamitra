import { jsonResponse } from '../../_lib/json.mjs';
import { createAuth } from '../../_lib/auth.mjs';
import { logAuthBindingDiagnostics } from '../../_lib/authBindingDiagnostics.mjs';

export async function onRequest(context) {
  let response;
  try {
    const auth = createAuth(context);
    response = await auth.handler(context.request);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    logAuthBindingDiagnostics(context, '[auth] Handler failed — binding probe');
    console.error('[auth] Handler failed', { message, stack });
    return jsonResponse({ error: 'Authentication service error.', code: 'AUTH_HANDLER_ERROR' }, 500);
  }

  if (!response.ok) {
    const bodyText = await response.clone().text();
    if (bodyText.includes('SES_SANDBOX_ERROR')) {
      return jsonResponse(
        {
          code: 'SES_SANDBOX_ERROR',
          error:
            'Email could not be delivered. Your Amazon SES account is in sandbox mode — verify the recipient address or exit sandbox.',
        },
        403,
      );
    }
  }

  return response;
}
