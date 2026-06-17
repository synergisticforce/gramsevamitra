import { jsonResponse } from '../../_lib/json.mjs';
import { deductOperationCredits, requireProCredits } from '../../_lib/creditEconomy.mjs';
import { runSmartRouter } from '../../_lib/smartRouter.mjs';

const ALLOWED_FORMATS = new Set(['json', 'csv', 'docx']);
const ALLOWED_DOC_TYPES = new Set(['invoice', 'bank_statement', 'general']);

export async function onRequestPost(context) {
  const { request, env } = context;

  const gate = await requireProCredits(request, context, 'smart-router');
  if (!gate.ok) {
    return jsonResponse(gate.body, gate.status);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Bad Request', message: 'Invalid JSON body.' }, 400);
  }

  const outputFormat = typeof body.outputFormat === 'string' ? body.outputFormat.toLowerCase() : 'json';
  const documentType = typeof body.documentType === 'string' ? body.documentType : 'invoice';
  const fileName = typeof body.fileName === 'string' ? body.fileName.slice(0, 200) : 'document.pdf';
  const forceFailsafe = Boolean(body.forceFailsafe);

  if (!ALLOWED_FORMATS.has(outputFormat)) {
    return jsonResponse({ error: 'Bad Request', message: 'outputFormat must be json, csv, or docx.' }, 400);
  }

  if (!ALLOWED_DOC_TYPES.has(documentType)) {
    return jsonResponse(
      { error: 'Bad Request', message: 'documentType must be invoice, bank_statement, or general.' },
      400,
    );
  }

  try {
    const result = await runSmartRouter({
      outputFormat,
      documentType,
      fileName,
      forceFailsafe,
    });

    const remainingCredits = await deductOperationCredits(env, gate.user.id, 'smart-router');
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
      userId: gate.user.id,
      creditsUsed: gate.cost,
      remainingCredits,
      ...result,
    });
  } catch (err) {
    console.error('Smart Router error:', err);
    return jsonResponse({ error: 'Internal Server Error', message: 'Smart Router processing failed.' }, 500);
  }
}

export async function onRequest(context) {
  if (context.request.method === 'POST') {
    return onRequestPost(context);
  }
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
