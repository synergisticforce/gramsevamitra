import { jsonResponse } from '../../_lib/json.mjs';
import { deductOperationCredits } from '../../_lib/creditEconomy.mjs';
import { getOperationCreditCost } from '../../../packages/shared/src/lib/aiCredits.mjs';
import { convertDocumentWithCloud } from '../../_lib/documentCloudOcr.mjs';
import { getNeonSql, hasNeonDatabase } from '../../_lib/neonDb.mjs';
import { ensureNeonSchema } from '../../_lib/neonSchema.mjs';
import { getRuntimeEnv, readEnvFromContext } from '../../_lib/runtimeEnv.mjs';
import { getSessionUser } from '../../_lib/session.mjs';
import { getUserRow } from '../../_lib/userDb.mjs';
import {
  hashClientIp,
  releaseGuestQuota,
  reserveGuestQuota,
  resolveDeviceCookie,
  verifyTurnstile,
  withSetCookie,
} from '../../_lib/guestAccess.mjs';

const FREE_CLOUD_READS = 2;
const MAX_BYTES = 8 * 1024 * 1024;
const OPERATION_ID = 'document-ocr';

function readKey(context, env, name) {
  return readEnvFromContext(context, name) || (typeof env?.[name] === 'string' ? env[name].trim() : '');
}

export async function onRequestPost(context) {
  const { request } = context;
  const env = getRuntimeEnv(context);
  const device = await resolveDeviceCookie(request, readKey(context, env, 'BETTER_AUTH_SECRET'));
  const reply = (body, status = 200) => withSetCookie(jsonResponse(body, status), device.setCookie);

  if (!hasNeonDatabase(env)) {
    return reply(
      { success: false, creditsCharged: 0, message: 'Account database is not configured. No credits were deducted.' },
      503,
    );
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || file.size <= 0) {
    return reply({ success: false, creditsCharged: 0, message: 'Attach a PDF or image.' }, 400);
  }
  if (file.size > MAX_BYTES) {
    return reply({ success: false, creditsCharged: 0, message: 'This file is larger than 8 MB.' }, 400);
  }

  const turnstileSecret = readKey(context, env, 'TURNSTILE_SECRET_KEY');
  const token = typeof form.get('cf-turnstile-response') === 'string' ? String(form.get('cf-turnstile-response')) : '';
  const human = await verifyTurnstile(token, turnstileSecret, request.headers.get('cf-connecting-ip') || '');
  if (!human) {
    return reply(
      { success: false, creditsCharged: 0, message: 'The bot check did not pass. Refresh and try again. No credits were deducted.' },
      403,
    );
  }

  const sql = getNeonSql(env);
  if (!sql) {
    return reply({ success: false, creditsCharged: 0, message: 'Account database is not configured.' }, 503);
  }
  try {
    await ensureNeonSchema(sql);
  } catch (err) {
    console.error('[document-smart-convert] schema init failed', err instanceof Error ? err.message : err);
    return reply({ success: false, creditsCharged: 0, message: 'The account database could not be prepared.' }, 503);
  }

  const sessionUser = await getSessionUser(request, context);
  const userRow = sessionUser?.id ? await getUserRow(env, sessionUser.id) : null;
  const isPro = userRow?.plan === 'pro';
  const creditCost = getOperationCreditCost(OPERATION_ID);
  const credits = userRow ? Number(userRow.credits ?? 0) : 0;
  const chargePro = Boolean(isPro && credits >= creditCost);
  /** @type {string[]} */
  let reserved = [];

  if (!chargePro) {
    const ipHash = await hashClientIp(request);
    const keys = [`device:${device.id}`, `ip:${ipHash}`];
    if (userRow?.id) keys.unshift(`user:${userRow.id}`);
    reserved = (await reserveGuestQuota(sql, keys, 'document-ocr', FREE_CLOUD_READS)) ?? [];
    if (!reserved.length) {
      return reply(
        {
          success: false,
          code: 'OCR_QUOTA',
          signInSuggested: !userRow,
          creditsCharged: 0,
          message: `The ${FREE_CLOUD_READS} free high-precision reads for this month are used. Clear scans still convert on this device.`,
        },
        429,
      );
    }
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
  const language = typeof form.get('language') === 'string' ? String(form.get('language')) : 'en';

  try {
    const result = await convertDocumentWithCloud({
      bytes,
      mimeType,
      fileName: file.name || 'document',
      language,
      azureEndpoint: readKey(context, env, 'AZURE_DOC_INTEL_ENDPOINT'),
      azureKey: readKey(context, env, 'AZURE_DOC_INTEL_KEY'),
      sarvamKey: readKey(context, env, 'SARVAM_API_KEY'),
      geminiKey: readKey(context, env, 'GEMINI_API_KEY'),
    });

    let creditsCharged = 0;
    if (chargePro && userRow) {
      const remaining = await deductOperationCredits(env, userRow.id, OPERATION_ID);
      creditsCharged = remaining === null ? 0 : creditCost;
    }

    return reply({
      success: true,
      rows: result.rows,
      text: result.text,
      provider: result.provider,
      creditsCharged,
      message: `High-precision read finished with ${result.provider}. ${creditsCharged ? `${creditsCharged} AI Credits used.` : '₹0 charged on the free monthly allowance.'}`,
    });
  } catch (err) {
    if (reserved.length) {
      try {
        await releaseGuestQuota(sql, reserved, 'document-ocr');
      } catch (releaseErr) {
        console.error('[document-smart-convert] quota release failed', releaseErr instanceof Error ? releaseErr.message : releaseErr);
      }
    }
    console.error('[document-smart-convert] failed', err instanceof Error ? err.message : err);
    return reply(
      {
        success: false,
        creditsCharged: 0,
        message: 'High-precision reading is unavailable right now. No credits were deducted.',
      },
      503,
    );
  }
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return jsonResponse({ error: 'Method Not Allowed', creditsCharged: 0 }, 405);
}
