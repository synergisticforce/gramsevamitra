import { jsonResponse } from '../../_lib/json.mjs';
import { deductOperationCredits } from '../../_lib/creditEconomy.mjs';
import { getOperationCreditCost } from '../../../packages/shared/src/lib/aiCredits.mjs';
import { getNeonSql, hasNeonDatabase } from '../../_lib/neonDb.mjs';
import { getRuntimeEnv, readEnvFromContext } from '../../_lib/runtimeEnv.mjs';
import { getSessionUser } from '../../_lib/session.mjs';
import { getUserRow } from '../../_lib/userDb.mjs';
import {
  CAREER_AI_ACTIONS,
  MAX_JOB_TEXT_CHARS,
  MAX_RESUME_TEXT_CHARS,
  filenameForCareerAction,
  generateCareerText,
  sanitizeCareerText,
  titleForCareerAction,
} from '../../_lib/careerLlm.mjs';
import {
  FREE_CAREER_GENERATIONS_PER_MONTH,
  releaseFreeGeneration,
  reserveFreeGeneration,
} from '../../_lib/careerQuota.mjs';
import { ensureNeonSchema } from '../../_lib/neonSchema.mjs';
import {
  hashClientIp,
  releaseGuestQuota,
  reserveGuestQuota,
  resolveDeviceCookie,
  verifyTurnstile,
  withSetCookie,
} from '../../_lib/guestAccess.mjs';

const OPERATION_ID = 'career-ai';

function readKey(context, env, name) {
  return readEnvFromContext(context, name) || (typeof env?.[name] === 'string' ? env[name].trim() : '');
}

export async function onRequestPost(context) {
  const { request } = context;
  const env = getRuntimeEnv(context);

  const authSecret = readKey(context, env, 'BETTER_AUTH_SECRET');
  const device = await resolveDeviceCookie(request, authSecret);
  const reply = (body, status = 200) => withSetCookie(jsonResponse(body, status), device.setCookie);

  if (!hasNeonDatabase(env)) {
    return reply(
      {
        success: false,
        error: 'Service Unavailable',
        code: 'DATABASE_UNAVAILABLE',
        creditsCharged: 0,
        message: 'Account database is not configured. Set DATABASE_URL (Neon PostgreSQL). No credits were deducted.',
      },
      503,
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return reply(
      { success: false, error: 'Bad Request', creditsCharged: 0, message: 'Send a JSON body.' },
      400,
    );
  }

  const action = typeof body.action === 'string' ? body.action : '';
  const resumeText = sanitizeCareerText(body.resumeText, MAX_RESUME_TEXT_CHARS);
  const jobText = sanitizeCareerText(body.jobText, MAX_JOB_TEXT_CHARS);
  const fileName = sanitizeCareerText(body.fileName, 200) || 'resume';

  if (!CAREER_AI_ACTIONS.has(action)) {
    return reply(
      { success: false, error: 'Bad Request', creditsCharged: 0, message: 'Unknown career action.' },
      400,
    );
  }
  if (resumeText.length < 40) {
    return reply(
      {
        success: false,
        error: 'Bad Request',
        creditsCharged: 0,
        message: 'Resume text is too short. Upload a text-based PDF or DOCX resume.',
      },
      400,
    );
  }

  const sarvamKey = readKey(context, env, 'SARVAM_API_KEY');
  const geminiKey = readKey(context, env, 'GEMINI_API_KEY');
  if (!sarvamKey && !geminiKey) {
    return reply(
      {
        success: false,
        error: 'Service Unavailable',
        code: 'CAREER_AI_UNCONFIGURED',
        creditsCharged: 0,
        message: 'Career AI is not configured. Set SARVAM_API_KEY or GEMINI_API_KEY. No credits were deducted.',
      },
      503,
    );
  }

  const turnstileSecret = readKey(context, env, 'TURNSTILE_SECRET_KEY');
  const turnstileToken = typeof body.turnstileToken === 'string' ? body.turnstileToken.trim() : '';
  const human = await verifyTurnstile(
    turnstileToken,
    turnstileSecret,
    request.headers.get('cf-connecting-ip') || '',
  );
  if (!human) {
    return reply(
      {
        success: false,
        error: 'Forbidden',
        code: 'TURNSTILE',
        creditsCharged: 0,
        message: 'The bot check did not pass. Refresh the page and try again. No credits were deducted.',
      },
      403,
    );
  }

  const sql = getNeonSql(env);
  if (!sql) {
    return reply(
      {
        success: false,
        error: 'Service Unavailable',
        creditsCharged: 0,
        message: 'Account database is not configured. No credits were deducted.',
      },
      503,
    );
  }
  try {
    await ensureNeonSchema(sql);
  } catch (err) {
    console.error('[career-ai] schema init failed', err instanceof Error ? err.message : err);
    return reply(
      {
        success: false,
        error: 'Service Unavailable',
        creditsCharged: 0,
        message: 'The account database could not be prepared. No credits were deducted.',
      },
      503,
    );
  }

  const sessionUser = await getSessionUser(request, context);
  const userRow = sessionUser?.id ? await getUserRow(env, sessionUser.id) : null;
  const isPro = userRow?.plan === 'pro';
  const creditCost = getOperationCreditCost(OPERATION_ID);
  /** @type {string | null} */
  let reservedKey = null;
  /** @type {string[]} */
  let reservedGuestKeys = [];
  let reservedUsed = 0;
  const language = typeof body.language === 'string' ? body.language.slice(0, 12) : 'en';

  if (isPro && userRow) {
    const credits = typeof userRow.credits === 'number' ? userRow.credits : Number(userRow.credits ?? 0);
    if (credits < creditCost) {
      return reply(
        {
          success: false,
          error: 'Payment Required',
          creditsCharged: 0,
          message: `Pro Career AI needs ${creditCost} AI Credits. You have ${credits}. Nothing was deducted.`,
          requiredCredits: creditCost,
          remainingCredits: credits,
        },
        402,
      );
    }
  } else {
    try {
      if (userRow?.id) {
        reservedKey = `user:${userRow.id}`;
        const used = await reserveFreeGeneration(sql, reservedKey);
        if (used === null) {
          reservedKey = null;
          return reply(
            {
              success: false,
              error: 'Too Many Requests',
              code: 'CAREER_QUOTA',
              creditsCharged: 0,
              signInSuggested: false,
              message: `The free plan includes ${FREE_CAREER_GENERATIONS_PER_MONTH} AI career generations per month. No credits were deducted.`,
              quotaRemaining: 0,
            },
            429,
          );
        }
        reservedUsed = used;
      } else {
        const ipHash = await hashClientIp(request);
        const reserved = await reserveGuestQuota(
          sql,
          [`device:${device.id}`, `ip:${ipHash}`],
          'career',
          FREE_CAREER_GENERATIONS_PER_MONTH,
        );
        if (!reserved) {
          return reply(
            {
              success: false,
              error: 'Too Many Requests',
              code: 'CAREER_QUOTA',
              creditsCharged: 0,
              signInSuggested: true,
              message: `The ${FREE_CAREER_GENERATIONS_PER_MONTH} free AI generations for this month are used. Sign in or wait until next month. No credits were deducted.`,
              quotaRemaining: 0,
            },
            429,
          );
        }
        reservedGuestKeys = reserved;
        reservedUsed = FREE_CAREER_GENERATIONS_PER_MONTH;
      }
    } catch (err) {
      reservedKey = null;
      console.error('[career-ai] quota table failed', err instanceof Error ? err.message : err);
      return reply(
        {
          success: false,
          error: 'Service Unavailable',
          creditsCharged: 0,
          message: 'Could not record the free monthly quota. Apply schema.postgres.sql on Neon. No credits were deducted.',
        },
        503,
      );
    }
  }

  const started = Date.now();

  try {
    const result = await generateCareerText({
      sarvamKey,
      geminiKey,
      action,
      resumeText,
      jobText,
      fileName,
      language,
    });

    let creditsCharged = 0;
    let remainingCredits = null;
    if (isPro && userRow) {
      remainingCredits = await deductOperationCredits(env, userRow.id, OPERATION_ID);
      creditsCharged = remainingCredits === null ? 0 : creditCost;
    }

    return reply({
      success: true,
      text: result.text,
      title: titleForCareerAction(action),
      fileName: filenameForCareerAction(action),
      provider: result.provider,
      model: result.model,
      processingMs: Date.now() - started,
      creditsCharged,
      remainingCredits,
      quotaRemaining: reservedKey
        ? Math.max(0, FREE_CAREER_GENERATIONS_PER_MONTH - reservedUsed)
        : null,
    });
  } catch (err) {
    if (reservedKey) {
      try {
        await releaseFreeGeneration(sql, reservedKey);
      } catch (releaseErr) {
        console.error('[career-ai] quota release failed', releaseErr instanceof Error ? releaseErr.message : releaseErr);
      }
    }
    if (reservedGuestKeys.length) {
      try {
        await releaseGuestQuota(sql, reservedGuestKeys, 'career');
      } catch (releaseErr) {
        console.error('[career-ai] guest quota release failed', releaseErr instanceof Error ? releaseErr.message : releaseErr);
      }
    }
    console.error('[career-ai] upstream failed', err instanceof Error ? err.message : err);
    return reply(
      {
        success: false,
        error: 'Service Unavailable',
        code: 'CAREER_UPSTREAM',
        creditsCharged: 0,
        message: 'The career model did not return a result. No credits were deducted. Please try again.',
      },
      503,
    );
  }
}

export async function onRequest(context) {
  if (context.request.method === 'POST') {
    return onRequestPost(context);
  }
  return jsonResponse(
    { error: 'Method Not Allowed', creditsCharged: 0, message: 'Use POST.' },
    405,
  );
}
