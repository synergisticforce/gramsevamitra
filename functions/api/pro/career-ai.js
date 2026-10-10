import { jsonResponse } from '../../_lib/json.mjs';

/**
 * Career AI used to return placeholder resume text and then charge AI Credits.
 * The buttons stay visible, but this route now refuses the job before any
 * credit check or deduction. A real model can replace this later.
 */
const UPGRADE_MESSAGE = 'Career AI is being upgraded. No credits were deducted.';

function upgradingResponse() {
  return jsonResponse(
    {
      success: false,
      error: 'Service Unavailable',
      code: 'CAREER_AI_UPGRADING',
      creditsCharged: 0,
      message: UPGRADE_MESSAGE,
    },
    503,
  );
}

export async function onRequestPost() {
  return upgradingResponse();
}

export async function onRequest(context) {
  if (context.request.method === 'POST') {
    return onRequestPost();
  }
  return jsonResponse(
    {
      error: 'Method Not Allowed',
      code: 'CAREER_AI_UPGRADING',
      creditsCharged: 0,
      message: UPGRADE_MESSAGE,
    },
    405,
  );
}
