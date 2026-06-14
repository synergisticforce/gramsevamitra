import { jsonResponse } from '../../_lib/json.mjs';
import { deductOperationCredits, requireProCredits } from '../../_lib/creditEconomy.mjs';
import { runSmartExtractJob } from '../../_lib/smartExtractHandler.mjs';

/** Tier 2 Smart Extract — accepts R2 objectKey or client-side extractedText (RAM Shield). */
export async function onRequestPost(context) {
  const { request, env } = context;

  const gate = await requireProCredits(request, env, 'extract');
  if (!gate.ok) {
    return jsonResponse(gate.body, gate.status);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Bad Request', message: 'Invalid JSON body.' }, 400);
  }

  const result = await runSmartExtractJob({
    env,
    userId: gate.user.id,
    body,
  });

  if (!result.ok) {
    return jsonResponse(result.body, result.status);
  }

  const remainingCredits = await deductOperationCredits(env, gate.user.id, 'extract');
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
    ...result.body,
    creditsUsed: gate.cost,
    remainingCredits,
  });
}

export async function onRequest(context) {
  if (context.request.method === 'POST') {
    return onRequestPost(context);
  }
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
