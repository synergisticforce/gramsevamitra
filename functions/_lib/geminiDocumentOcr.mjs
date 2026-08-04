/**
 * Gemini 2.5 Flash-Lite document OCR / layout reconstruction.
 * Uses @google/genai with inline PDF/image payloads (Workers-safe, no filesystem).
 */

import { GoogleGenAI } from '@google/genai';

export const DOCUMENT_OCR_MODEL = 'gemini-2.5-flash-lite';

export const DOCUMENT_OCR_SYSTEM_PROMPT =
  'Extract all text from this document. Preserve layout structure perfectly. Render tables as clean Markdown tables. Return only the raw Markdown.';

export const DOCUMENT_LAYOUT_HTML_PROMPT =
  'Extract all content from this document and reconstruct its visual layout into clean HTML. Preserve exact typography hierarchy, font sizes, colors, table structures, margins, and inline styles so it visually matches the original design as closely as possible.';

export const DOCUMENT_TABLE_JSON_PROMPT =
  'Extract every table and structured row of data from this document. Return ONLY a JSON array of arrays (2D grid of strings). The first row must be headers when present. No markdown fences, no commentary — pure JSON only.';

/** Max upload size for inline Gemini payloads (Workers memory + request limits). */
export const DOCUMENT_OCR_MAX_BYTES = 12 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

/**
 * @param {string} mimeType
 * @param {string} [fileName]
 */
export function resolveDocumentOcrMime(mimeType, fileName = '') {
  const raw = (mimeType || '').toLowerCase().trim();
  const name = (fileName || '').toLowerCase();

  if (ALLOWED_MIME.has(raw)) {
    return raw === 'image/jpg' ? 'image/jpeg' : raw;
  }
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.gif')) return 'image/gif';
  if (/\.(jpe?g)$/.test(name)) return 'image/jpeg';
  if (/\.(heic|heif)$/.test(name)) return 'image/heic';
  return '';
}

/**
 * @param {string} mimeType
 */
export function isAllowedDocumentOcrMime(mimeType) {
  return ALLOWED_MIME.has(mimeType) || mimeType === 'image/jpeg';
}

/**
 * Strip accidental Markdown fences Gemini sometimes wraps around output.
 * @param {string} text
 */
export function sanitizeMarkdownOutput(text) {
  let out = (text || '').trim();
  if (!out) return '';

  const fenced = /^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i.exec(out);
  if (fenced) {
    out = fenced[1].trim();
  }
  return out;
}

/**
 * Strip accidental HTML fences and keep only the document fragment/body.
 * @param {string} text
 */
export function sanitizeHtmlOutput(text) {
  let out = (text || '').trim();
  if (!out) return '';

  const fenced = /^```(?:html|htm)?\s*\n([\s\S]*?)\n```$/i.exec(out);
  if (fenced) {
    out = fenced[1].trim();
  }

  const lower = out.toLowerCase();
  if (lower.includes('<html') || lower.includes('<body')) {
    const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(out);
    if (bodyMatch) {
      out = bodyMatch[1].trim();
    }
  }

  out = out
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<\/?body[^>]*>/gi, '')
    .trim();

  return out;
}

/**
 * @param {{
 *   apiKey: string;
 *   mimeType: string;
 *   base64Data: string;
 *   fileName?: string;
 *   prompt?: string;
 * }} input
 */
async function generateGeminiDocumentContent(input) {
  const {
    apiKey,
    mimeType,
    base64Data,
    fileName = 'document',
    prompt = DOCUMENT_OCR_SYSTEM_PROMPT,
  } = input;

  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY is not configured.');
    err.code = 'CONFIG';
    throw err;
  }

  const resolvedMime = resolveDocumentOcrMime(mimeType, fileName);
  if (!resolvedMime || !isAllowedDocumentOcrMime(resolvedMime)) {
    const err = new Error('Upload a PDF or image (JPG, PNG, WEBP).');
    err.code = 'BAD_MIME';
    throw err;
  }

  if (!base64Data || typeof base64Data !== 'string') {
    const err = new Error('Document payload is missing.');
    err.code = 'BAD_PAYLOAD';
    throw err;
  }

  const ai = new GoogleGenAI({ apiKey });

  let response;
  try {
    response = await ai.models.generateContent({
      model: DOCUMENT_OCR_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: resolvedMime,
                data: base64Data,
              },
            },
          ],
        },
      ],
    });
  } catch (err) {
    throw classifyGeminiSdkError(err);
  }

  const text = typeof response.text === 'string' ? response.text : '';
  return { text, mimeType: resolvedMime };
}

/**
 * Map @google/genai / fetch failures into stable error codes for the API layer.
 * @param {unknown} err
 */
export function classifyGeminiSdkError(err) {
  const rawMessage =
    err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
      ? err.message
      : String(err ?? 'Unknown Vision AI error');
  const status =
    err && typeof err === 'object' && 'status' in err ? Number(err.status) : undefined;
  const lower = rawMessage.toLowerCase();

  const wrapped = new Error(rawMessage);
  if (
    lower.includes('api key') ||
    lower.includes('api_key') ||
    lower.includes('permission denied') ||
    lower.includes('unauthenticated') ||
    status === 401 ||
    status === 403
  ) {
    wrapped.code = 'API_KEY';
    wrapped.message = `Missing or invalid GEMINI_API_KEY: ${rawMessage}`;
    return wrapped;
  }

  if (
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('deadline') ||
    lower.includes('etimedout') ||
    status === 408 ||
    status === 504
  ) {
    wrapped.code = 'TIMEOUT';
    wrapped.message = `Gemini API Timeout: ${rawMessage}`;
    return wrapped;
  }

  if (
    lower.includes('too large') ||
    lower.includes('payload') ||
    lower.includes('request entity') ||
    lower.includes('size') ||
    status === 413
  ) {
    wrapped.code = 'PAYLOAD_TOO_LARGE';
    wrapped.message = `Payload too large for Vision AI: ${rawMessage}`;
    return wrapped;
  }

  if (lower.includes('quota') || lower.includes('rate') || status === 429) {
    wrapped.code = 'RATE_LIMIT';
    wrapped.message = `Gemini rate limit / quota exceeded: ${rawMessage}`;
    return wrapped;
  }

  wrapped.code = 'GEMINI';
  wrapped.message = `Gemini API error: ${rawMessage}`;
  return wrapped;
}

/**
 * @param {{
 *   apiKey: string;
 *   mimeType: string;
 *   base64Data: string;
 *   fileName?: string;
 * }} input
 */
export async function runGeminiDocumentOcr(input) {
  const { text, mimeType } = await generateGeminiDocumentContent({
    ...input,
    prompt: DOCUMENT_OCR_SYSTEM_PROMPT,
  });

  const markdown = sanitizeMarkdownOutput(text);
  if (!markdown) {
    const err = new Error('Vision AI returned empty text. Try a clearer scan.');
    err.code = 'EMPTY';
    throw err;
  }

  return {
    markdown,
    model: DOCUMENT_OCR_MODEL,
    mimeType,
  };
}

/**
 * Layout-preserving HTML reconstruction for Word export.
 * @param {{
 *   apiKey: string;
 *   mimeType: string;
 *   base64Data: string;
 *   fileName?: string;
 * }} input
 */
export async function runGeminiDocumentLayoutHtml(input) {
  const { text, mimeType } = await generateGeminiDocumentContent({
    ...input,
    prompt: DOCUMENT_LAYOUT_HTML_PROMPT,
  });

  const html = sanitizeHtmlOutput(text);
  if (!html) {
    const err = new Error('Vision AI returned empty layout HTML. Try a clearer scan.');
    err.code = 'EMPTY';
    throw err;
  }

  return {
    html,
    model: DOCUMENT_OCR_MODEL,
    mimeType,
  };
}

/**
 * Table / grid extraction for XLSX / CSV exports.
 * @param {{
 *   apiKey: string;
 *   mimeType: string;
 *   base64Data: string;
 *   fileName?: string;
 * }} input
 */
export async function runGeminiDocumentTableJson(input) {
  const { text, mimeType } = await generateGeminiDocumentContent({
    ...input,
    prompt: DOCUMENT_TABLE_JSON_PROMPT,
  });

  let raw = (text || '').trim();
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n```$/i.exec(raw);
  if (fenced) raw = fenced[1].trim();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const err = new Error('Vision AI returned invalid table JSON. Try a clearer scan.');
    err.code = 'EMPTY';
    throw err;
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    const err = new Error('Vision AI returned an empty table. Try a clearer scan.');
    err.code = 'EMPTY';
    throw err;
  }

  const rows = parsed.map((row) => {
    if (Array.isArray(row)) return row.map((cell) => String(cell ?? ''));
    if (row && typeof row === 'object') return Object.values(row).map((cell) => String(cell ?? ''));
    return [String(row ?? '')];
  });

  return {
    rows,
    model: DOCUMENT_OCR_MODEL,
    mimeType,
  };
}

/**
 * @param {ArrayBuffer | Uint8Array} bytes
 */
export function bytesToBase64(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(view).toString('base64');
  }

  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < view.length; i += chunk) {
    binary += String.fromCharCode(...view.subarray(i, i + chunk));
  }
  return btoa(binary);
}
