import { jsonResponse } from '../../_lib/json.mjs';
import { createAuth } from '../../_lib/auth.mjs';
import { getRuntimeEnv } from '../../_lib/runtimeEnv.mjs';

export async function onRequest(context) {
  const auth = createAuth(getRuntimeEnv(context));
  const response = await auth.handler(context.request);

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
