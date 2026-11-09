import { jsonResponse } from '../../_lib/json.mjs';
import { extractScannedPayout } from '../../_lib/cloudOcrArbitrage.mjs';
import { getRuntimeEnv, readEnvFromContext } from '../../_lib/runtimeEnv.mjs';

function readKey(context, env, name) {
  return readEnvFromContext(context, name) || (typeof env?.[name] === 'string' ? env[name].trim() : '');
}

export async function onRequestPost(context) {
  const env = getRuntimeEnv(context);
  const form = await context.request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || file.size <= 0) {
    return jsonResponse({ success: false, message: 'Attach a PDF or image.' }, 400);
  }
  const azureKey = readKey(context, env, 'AZURE_DOC_INTEL_KEY');
  const sarvamKey = readKey(context, env, 'SARVAM_API_KEY');
  const geminiKey = readKey(context, env, 'GEMINI_API_KEY');
  if (!azureKey && !sarvamKey && !geminiKey) {
    return jsonResponse(
      { success: false, creditsCharged: 0, message: 'Cloud reading is not configured. No credits were deducted.' },
      503,
    );
  }
  try {
    const result = await extractScannedPayout({
      bytes: new Uint8Array(await file.arrayBuffer()),
      mimeType: file.type || 'application/pdf',
      fileName: file.name || 'payout.pdf',
      language: typeof form.get('language') === 'string' ? String(form.get('language')) : 'en',
      azureEndpoint: readKey(context, env, 'AZURE_DOC_INTEL_ENDPOINT'),
      azureKey,
      sarvamKey,
      geminiKey,
    });
    return jsonResponse({ success: true, rows: result.rows || [], text: result.text || '', provider: result.provider, creditsCharged: 0 });
  } catch (err) {
    console.error('[ocr-extract]', err instanceof Error ? err.message : err);
    return jsonResponse(
      { success: false, creditsCharged: 0, message: 'Cloud reading did not return a result. No credits were deducted.' },
      503,
    );
  }
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
