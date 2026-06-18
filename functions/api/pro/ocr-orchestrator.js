import { jsonResponse } from '../../_lib/json.mjs';
import { deductOperationCredits, requireProCredits } from '../../_lib/creditEconomy.mjs';
import { assertProObjectKeyForUser } from '../../_lib/proTransientStorage.mjs';
import { runOcrOrchestrator } from '../../_lib/ocrOrchestrator.mjs';

const ALLOWED_FORMATS = new Set(['text', 'json', 'csv', 'docx']);
const ALLOWED_DOC_TYPES = new Set(['invoice', 'bank_statement', 'general']);

export async function onRequestPost(context) {
  const { request, env } = context;

  const gate = await requireProCredits(request, context, 'ocr-orchestrator');
  if (!gate.ok) {
    return jsonResponse(gate.body, gate.status);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Bad Request', message: 'Invalid JSON body.' }, 400);
  }

  const outputFormat = typeof body.outputFormat === 'string' ? body.outputFormat.toLowerCase() : 'csv';
  const documentType = typeof body.documentType === 'string' ? body.documentType : 'invoice';
  const fileName = typeof body.fileName === 'string' ? body.fileName.slice(0, 200) : 'document.pdf';
  const objectKey = typeof body.objectKey === 'string' ? body.objectKey : '';
  const tier1Text = typeof body.tier1Text === 'string' ? body.tier1Text.trim().slice(0, 120_000) : '';
  const structuredTool = Boolean(body.structuredTool);
  const forceFailsafe = Boolean(body.forceFailsafe);
  const simulateUnreadable = Boolean(body.simulateUnreadable);

  if (!ALLOWED_FORMATS.has(outputFormat)) {
    return jsonResponse(
      { error: 'Bad Request', message: 'outputFormat must be text, json, csv, or docx.' },
      400,
    );
  }

  if (!ALLOWED_DOC_TYPES.has(documentType)) {
    return jsonResponse(
      { error: 'Bad Request', message: 'documentType must be invoice, bank_statement, or general.' },
      400,
    );
  }

  if (objectKey) {
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
  } else if (!tier1Text) {
    return jsonResponse(
      { error: 'Bad Request', message: 'Provide objectKey (scanned upload) or tier1Text.' },
      400,
    );
  }

  try {
    const result = await runOcrOrchestrator({
      objectKey,
      fileName,
      outputFormat,
      documentType,
      structuredTool: structuredTool || outputFormat === 'json' || outputFormat === 'csv',
      tier1Text,
      forceFailsafe,
      simulateUnreadable,
    });

    if (!result.ok) {
      return jsonResponse(result.body, result.status);
    }

    if (objectKey && env.PRO_TRANSIENT) {
      context.waitUntil?.(
        env.PRO_TRANSIENT.delete(objectKey).catch((err) => {
          console.warn('OCR orchestrator cleanup failed:', objectKey, err);
        }),
      );
    }

    const remainingCredits = await deductOperationCredits(env, gate.user.id, 'ocr-orchestrator');
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
  } catch (err) {
    console.error('OCR orchestrator error:', err);
    return jsonResponse(
      { error: 'Internal Server Error', message: 'OCR orchestrator processing failed.' },
      500,
    );
  }
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
