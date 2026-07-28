/**
 * Gemini 2.5 Flash-Lite document OCR / layout reconstruction.
 * Uses @google/genai with inline PDF/image payloads (Workers-safe, no filesystem).
 */

import { GoogleGenAI } from '@google/genai';

export const DOCUMENT_OCR_MODEL = 'gemini-2.5-flash-lite';

export const DOCUMENT_OCR_SYSTEM_PROMPT =
  'Extract all text from this document. Preserve layout structure perfectly. Render tables as clean Markdown tables. Return only the raw Markdown.';

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
 * @param {{
 *   apiKey: string;
 *   mimeType: string;
 *   base64Data: string;
 *   fileName?: string;
 * }} input
 */
export async function runGeminiDocumentOcr(input) {
  const { apiKey, mimeType, base64Data, fileName = 'document' } = input;

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

  const response = await ai.models.generateContent({
    model: DOCUMENT_OCR_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { text: DOCUMENT_OCR_SYSTEM_PROMPT },
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

  const markdown = sanitizeMarkdownOutput(
    typeof response.text === 'string' ? response.text : '',
  );

  if (!markdown) {
    const err = new Error('Vision AI returned empty text. Try a clearer scan.');
    err.code = 'EMPTY';
    throw err;
  }

  return {
    markdown,
    model: DOCUMENT_OCR_MODEL,
    mimeType: resolvedMime,
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
