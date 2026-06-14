import { jsonResponse } from '../../../_lib/json.mjs';
import { requireProUser } from '../../../_lib/proGate.mjs';
import {
  buildMockCareerAiResponse,
  CAREER_AI_ACTIONS,
  MOCK_CAREER_AI_DELAY_MS,
  outputFilenameForAction,
  sanitizeResumeText,
  titleForAction,
} from '../../../_lib/careerAiMock.mjs';

export async function onRequestPost(context) {
  const { request, env } = context;

  const gate = await requireProUser(request, env);
  if (!gate.ok) {
    return jsonResponse(gate.body, gate.status);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Bad Request', message: 'Invalid JSON body.' }, 400);
  }

  const action = typeof body.action === 'string' ? body.action : '';
  const resumeText = sanitizeResumeText(body.resumeText);
  const sourceFileName =
    typeof body.fileName === 'string' ? body.fileName.slice(0, 200) : 'resume.pdf';

  if (!CAREER_AI_ACTIONS.has(action)) {
    return jsonResponse(
      { error: 'Bad Request', message: 'action must be rewrite_resume or generate_cover_letter.' },
      400,
    );
  }

  if (!resumeText) {
    return jsonResponse(
      { error: 'Bad Request', message: 'resumeText is required and must contain readable content.' },
      400,
    );
  }

  const started = Date.now();
  await new Promise((resolve) => setTimeout(resolve, MOCK_CAREER_AI_DELAY_MS));

  const text = buildMockCareerAiResponse(action, resumeText);
  const processingMs = Date.now() - started;

  return jsonResponse({
    success: true,
    action,
    title: titleForAction(action),
    text,
    fileName: outputFilenameForAction(action),
    sourceFile: sourceFileName,
    processingMs,
    mock: true,
  });
}

export async function onRequest(context) {
  if (context.request.method === 'POST') {
    return onRequestPost(context);
  }
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
