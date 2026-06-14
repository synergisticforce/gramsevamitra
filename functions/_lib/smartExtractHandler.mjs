import {
  assertProObjectKeyForUser,
  MOCK_EXTRACT_CSV,
  MOCK_EXTRACT_DELAY_MS,
} from './proTransientStorage.mjs';

const MAX_EXTRACTED_TEXT_CHARS = 120_000;

/**
 * @param {string} text
 */
export function sanitizeExtractedText(text) {
  if (typeof text !== 'string') return '';
  return text.trim().slice(0, MAX_EXTRACTED_TEXT_CHARS);
}

/**
 * Run Smart Extract (mock Tier 2 pipeline) from R2 object or pre-extracted text.
 * @param {{
 *   env: import('@gramsevamitra/auth').AuthEnv & { PRO_TRANSIENT?: R2Bucket };
 *   userId: string;
 *   body: Record<string, unknown>;
 * }} input
 */
export async function runSmartExtractJob({ env, userId, body }) {
  const extractedText = sanitizeExtractedText(body.extractedText);
  const objectKey = typeof body.objectKey === 'string' ? body.objectKey : '';
  const fileName =
    typeof body.fileName === 'string' ? body.fileName.slice(0, 200) : 'document.pdf';
  const textMode = extractedText.length > 0;

  if (!textMode) {
    if (!objectKey) {
      return {
        ok: false,
        status: 400,
        body: {
          error: 'Bad Request',
          message: 'Provide objectKey or extractedText for Smart Extract.',
        },
      };
    }

    if (!assertProObjectKeyForUser(objectKey, userId)) {
      return {
        ok: false,
        status: 403,
        body: { error: 'Forbidden', message: 'Invalid or unauthorized object reference.' },
      };
    }

    if (!env.PRO_TRANSIENT) {
      return {
        ok: false,
        status: 503,
        body: { error: 'Service Unavailable', message: 'Transient storage is not configured.' },
      };
    }

    const head = await env.PRO_TRANSIENT.head(objectKey);
    if (!head) {
      return {
        ok: false,
        status: 404,
        body: { error: 'Not Found', message: 'Uploaded document not found or already expired.' },
      };
    }
  } else if (extractedText.length < 32) {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'Bad Request',
        message: 'extractedText is too short for Smart Extract. Try a text-based PDF.',
      },
    };
  }

  const started = Date.now();
  await new Promise((resolve) => setTimeout(resolve, MOCK_EXTRACT_DELAY_MS));

  if (!textMode && env.PRO_TRANSIENT && objectKey) {
    try {
      await env.PRO_TRANSIENT.delete(objectKey);
    } catch (err) {
      console.warn('Failed to delete transient object after extract:', objectKey, err);
    }
  }

  return {
    ok: true,
    body: {
      success: true,
      format: 'csv',
      csv: MOCK_EXTRACT_CSV,
      fileName: 'extracted_data.csv',
      sourceFile: fileName,
      objectKey: textMode ? undefined : objectKey,
      textMode,
      extractedChars: textMode ? extractedText.length : undefined,
      processingMs: Date.now() - started,
      mock: true,
    },
  };
}
