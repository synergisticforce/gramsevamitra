import { jsonResponse } from '../../_lib/json.mjs';
import { extractScannedPayout } from '../../_lib/cloudOcrArbitrage.mjs';
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
  withSetCookie,
} from '../../_lib/guestAccess.mjs';

const FREE_PAYOUT_CLOUD_READS = 2;

function readKey(context, env, name) {
  return readEnvFromContext(context, name) || (typeof env?.[name] === 'string' ? env[name].trim() : '');
}

export async function onRequestPost(context) {
  const { request } = context;
  const env = getRuntimeEnv(context);
  const device = await resolveDeviceCookie(request, readKey(context, env, 'BETTER_AUTH_SECRET'));
  const reply = (body, status = 200) => withSetCookie(jsonResponse(body, status), device.setCookie);

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || file.size <= 0) {
    return reply({ success: false, creditsCharged: 0, message: 'Attach a PDF or image.' }, 400);
  }

  const azureKey = readKey(context, env, 'AZURE_DOC_INTEL_KEY');
  const sarvamKey = readKey(context, env, 'SARVAM_API_KEY');
  const geminiKey = readKey(context, env, 'GEMINI_API_KEY');
  if (!azureKey && !sarvamKey && !geminiKey) {
    return reply(
      { success: false, creditsCharged: 0, message: 'Cloud reading is not configured. No credits were deducted.' },
      503,
    );
  }

  /** @type {string[]} */
  let reserved = [];
  if (hasNeonDatabase(env)) {
    const sql = getNeonSql(env);
    if (sql) {
      try {
        await ensureNeonSchema(sql);
        const sessionUser = await getSessionUser(request, context);
        const userRow = sessionUser?.id ? await getUserRow(env, sessionUser.id) : null;
        const isPro = userRow?.plan === 'pro';
        if (!isPro) {
          const ipHash = await hashClientIp(request);
          const keys = [`device:${device.id}`, `ip:${ipHash}`];
          if (userRow?.id) keys.unshift(`user:${userRow.id}`);
          reserved = (await reserveGuestQuota(sql, keys, 'payout-ocr', FREE_PAYOUT_CLOUD_READS)) ?? [];
          if (!reserved.length) {
            return reply(
              {
                success: false,
                code: 'OCR_QUOTA',
                creditsCharged: 0,
                message: `The ${FREE_PAYOUT_CLOUD_READS} free cloud payout reads for this month are used. Clear Excel and CSV files still check on this device.`,
              },
              429,
            );
          }
        }
      } catch (err) {
        console.error('[ocr-extract] guest quota', err instanceof Error ? err.message : err);
      }
    }
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
    return reply({
      success: true,
      rows: result.rows || [],
      text: result.text || '',
      provider: result.provider,
      creditsCharged: 0,
    });
  } catch (err) {
    console.error('[ocr-extract]', err instanceof Error ? err.message : err);
    if (reserved.length && hasNeonDatabase(env)) {
      const sql = getNeonSql(env);
      if (sql) {
        try {
          await releaseGuestQuota(sql, reserved, 'payout-ocr');
        } catch (releaseErr) {
          console.error('[ocr-extract] release quota', releaseErr instanceof Error ? releaseErr.message : releaseErr);
        }
      }
    }
    return reply(
      { success: false, creditsCharged: 0, message: 'Cloud reading did not return a result. No credits were deducted.' },
      503,
    );
  }
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return jsonResponse({ error: 'Method Not Allowed', creditsCharged: 0 }, 405);
}
