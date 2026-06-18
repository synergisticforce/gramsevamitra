import { jsonResponse } from '../../_lib/json.mjs';
import { deductOperationCredits, requireProCredits } from '../../_lib/creditEconomy.mjs';
import { assertProObjectKeyForUser } from '../../_lib/proTransientStorage.mjs';
import { runLayoutReconstruction } from '../../_lib/reconstructLayout.mjs';

const ALLOWED_FORMATS = new Set(['txt', 'docx', 'xlsx', 'csv', 'xml']);

export async function onRequestPost(context) {
  const { request, env } = context;

  const gate = await requireProCredits(request, context, 'reconstruct-layout');
  if (!gate.ok) {
    return jsonResponse(gate.body, gate.status);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Bad Request', message: 'Invalid JSON body.' }, 400);
  }

  const objectKey = typeof body.objectKey === 'string' ? body.objectKey : '';
  const fileName =
    typeof body.fileName === 'string' ? body.fileName.slice(0, 200) : 'document.pdf';
  const outputFormat =
    typeof body.outputFormat === 'string' ? body.outputFormat.toLowerCase() : 'docx';

  if (!ALLOWED_FORMATS.has(outputFormat)) {
    return jsonResponse(
      { error: 'Bad Request', message: 'outputFormat must be txt, docx, or xlsx.' },
      400,
    );
  }

  if (!assertProObjectKeyForUser(objectKey, gate.user.id)) {
    return jsonResponse(
      { error: 'Forbidden', message: 'Invalid or unauthorized object reference.' },
      403,
    );
  }

  if (!env.PRO_TRANSIENT) {
    return jsonResponse(
      { error: 'Service Unavailable', message: 'Transient storage is not configured.' },
      503,
    );
  }

  const head = await env.PRO_TRANSIENT.head(objectKey);
  if (!head) {
    return jsonResponse(
      { error: 'Not Found', message: 'Uploaded document not found or already expired.' },
      404,
    );
  }

  const started = Date.now();
  const stages = [];

  try {
    const result = await runLayoutReconstruction({
      fileName,
      outputFormat,
      onStage: (label) => stages.push(label),
    });

    try {
      await env.PRO_TRANSIENT.delete(objectKey);
    } catch (err) {
      console.warn('Failed to delete transient object after layout reconstruction:', objectKey, err);
    }

    const remainingCredits = await deductOperationCredits(env, gate.user.id, 'reconstruct-layout');
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

    const fileBase64 = Buffer.from(result.bytes).toString('base64');

    return jsonResponse({
      success: true,
      format: result.format,
      fileName: result.fileName,
      contentType: result.contentType,
      fileBase64,
      processingMs: Date.now() - started,
      creditsUsed: gate.cost,
      remainingCredits,
      stages,
      pipeline: result.pipeline,
      mock: Boolean(result.mockDocx || result.mockSpreadsheet),
    });
  } catch (err) {
    console.error('Layout reconstruction failed:', err);
    return jsonResponse(
      { error: 'Internal Server Error', message: 'Layout reconstruction failed.' },
      500,
    );
  }
}

export async function onRequest(context) {
  if (context.request.method === 'POST') {
    return onRequestPost(context);
  }
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
