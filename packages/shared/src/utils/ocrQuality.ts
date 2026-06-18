/** OCR waterfall thresholds — keep in sync with functions/_lib/ocrOrchestrator.mjs */

export const OCR_TIER1_CONFIDENCE_MIN = 65;
export const OCR_PADDLE_WORD_CONFIDENCE_MIN = 80;
export const OCR_GLM_INFERENCE_MAX_MS = 30_000;
export const OCR_GLM_COLD_START_GRACE_MS = 12_000;
export const OCR_TIER1_MAX_SAMPLE_PAGES = 2;

export interface OcrWordConfidence {
  confidence?: number;
}

export function averageWordConfidencePercent(words: OcrWordConfidence[]): number {
  if (!words.length) return 0;
  const values = words
    .map((w) => (typeof w.confidence === 'number' ? w.confidence : 0))
    .filter((c) => c >= 0);
  if (!values.length) return 0;
  return values.reduce((sum, c) => sum + c, 0) / values.length;
}

/**
 * Detect whitespace-only, symbol soup, or repetitive unreadable OCR garbage.
 * Does NOT reject short valid strings (e.g. 6-digit roll numbers).
 */
export function isOcrGibberish(text: string): boolean {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!trimmed) return true;

  const compact = trimmed.replace(/\s/g, '');
  if (compact.length >= 6 && /^(.)\1{5,}$/.test(compact)) return true;

  const lettersAndDigits = trimmed.match(/[\p{L}\p{N}]/gu);
  const alnumLen = lettersAndDigits?.length ?? 0;
  if (alnumLen === 0) return true;

  const symbolRatio = 1 - alnumLen / trimmed.length;
  if (trimmed.length > 12 && symbolRatio > 0.62) return true;

  if (/[□▯■]{2,}/.test(trimmed)) return true;

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length >= 4) {
    const singleCharTokens = tokens.filter((t) => t.length === 1 && !/\d/.test(t)).length;
    if (singleCharTokens / tokens.length > 0.55) return true;
  }

  return false;
}

export function tier1NeedsProHandoff(text: string, averageConfidencePercent: number): boolean {
  if (averageConfidencePercent < OCR_TIER1_CONFIDENCE_MIN) return true;
  if (isOcrGibberish(text)) return true;
  return false;
}

export const OCR_WATERFALL_LOADER_STAGES = {
  tier1: 'Enhancing text clarity…',
  paddle: 'Parsing layout matrix…',
  glm: 'Applying deep AI reconstruction…',
  vision: 'Applying premium vision fallback…',
  finalize: 'Finalizing extraction…',
} as const;
