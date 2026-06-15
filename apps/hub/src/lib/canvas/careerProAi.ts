export type CareerProAiAction = 'rewrite_resume' | 'generate_cover_letter';

export interface CareerProAiProgress {
  label: string;
  percent: number;
}

export interface CareerProAiResult {
  text: string;
  action: CareerProAiAction;
  title: string;
  fileName: string;
  processingMs?: number;
}

const TOOLBAR_TO_API: Record<string, CareerProAiAction> = {
  'ai-resume-rewriter': 'rewrite_resume',
  'ai-cover-letter': 'generate_cover_letter',
};

export function resolveCareerProAction(actionId: string): CareerProAiAction | null {
  return TOOLBAR_TO_API[actionId] ?? null;
}

import { parseCreditApiError } from '../auth/creditCheck';

function startAiProgressTicker(
  action: CareerProAiAction,
  onProgress: (progress: CareerProAiProgress) => void
): () => void {
  const label =
    action === 'rewrite_resume'
      ? 'Running advanced AI resume optimization…'
      : 'Generating advanced AI cover letter…';
  let percent = 45;
  onProgress({ label, percent });
  const timer = window.setInterval(() => {
    percent = Math.min(92, percent + 2);
    onProgress({ label, percent });
  }, 450);
  return () => window.clearInterval(timer);
}

export async function runCareerProAiPipeline(
  resumeText: string,
  fileName: string,
  action: CareerProAiAction,
  onProgress: (progress: CareerProAiProgress) => void
): Promise<CareerProAiResult> {
  onProgress({ label: 'Sending resume text to secure Pro AI endpoint…', percent: 15 });

  const stopTicker = startAiProgressTicker(action, onProgress);

  let response: Response;
  try {
    response = await fetch('/api/pro/career-ai', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        resumeText,
        fileName,
      }),
    });
  } finally {
    stopTicker();
  }

  let payload: {
    success?: boolean;
    text?: string;
    title?: string;
    fileName?: string;
    processingMs?: number;
    message?: string;
    error?: string;
  };

  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    throw new Error('Pro AI processing failed — invalid server response.');
  }

  if (response.status === 401 || response.status === 403 || response.status === 402) {
    throw new Error(parseCreditApiError(response.status, payload, 'Pro subscription required.'));
  }

  if (!response.ok || !payload.success || !payload.text) {
    throw new Error(parseCreditApiError(response.status, payload, 'Pro AI processing failed.'));
  }

  onProgress({ label: 'Preparing results…', percent: 98 });

  return {
    text: payload.text,
    action,
    title: payload.title ?? (action === 'rewrite_resume' ? 'AI Resume Rewriter' : 'AI Cover Letter'),
    fileName: payload.fileName ?? (action === 'rewrite_resume' ? 'ai-optimized-resume.txt' : 'ai-cover-letter.txt'),
    processingMs: payload.processingMs,
  };
}
