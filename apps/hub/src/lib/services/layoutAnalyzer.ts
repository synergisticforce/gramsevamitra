import { isImageMimeOrName, isPdfMimeOrName } from '../canvas/documentPdfTools';

export type DocumentProfile = 'SCANNED' | 'NATIVE';

export interface LayoutAnalysisResult {
  profile: DocumentProfile;
  complexLayout: boolean;
  hasNativeTextLayer: boolean;
  pageCount: number;
  sampleText: string;
  analysisMs: number;
}

const ANALYSIS_BUDGET_MS = 300;
const SAMPLE_PAGE_LIMIT = 2;

function scanPdfDictionaryForTextLayer(bytes: Uint8Array): boolean {
  const sample = new TextDecoder('latin1').decode(bytes.slice(0, Math.min(bytes.length, 512_000)));
  const hasFont = /\/Type\s*\/Font\b/.test(sample) || /\/FontDescriptor\b/.test(sample);
  const hasTextOps =
    /\bBT\b/.test(sample) && (/\bTj\b/.test(sample) || /\bTJ\b/.test(sample) || /\bT\*[\s\S]{0,40}\bTj\b/.test(sample));
  return hasFont && hasTextOps;
}

function detectComplexLayout(text: string): boolean {
  const normalized = text.replace(/--- Page \d+ ---/g, '');
  const delimiterHits = (normalized.match(/\||\t|\s{3,}/g) ?? []).length;
  if (delimiterHits >= 8) return true;

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 4) return false;

  const lengths = lines.map((line) => line.length);
  const avg = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;
  if (avg <= 0) return false;

  const variance = lengths.reduce((sum, len) => sum + (len - avg) ** 2, 0) / lengths.length;
  const stdDev = Math.sqrt(variance);
  return stdDev / avg > 0.55;
}

async function extractSamplePagesText(file: File, maxPages: number): Promise<{ text: string; pageCount: number }> {
  const { loadPdfDocument } = await import('../pdf/pdfRender');
  const pdf = await loadPdfDocument(file);
  const pagesToRead = Math.min(maxPages, pdf.numPages);
  const parts: string[] = [];

  for (let p = 1; p <= pagesToRead; p += 1) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .trim();
    parts.push(pageText || '');
    page.cleanup();
  }

  return { text: parts.join('\n'), pageCount: pdf.numPages };
}

async function analyzeDocumentLayoutInternal(file: File): Promise<LayoutAnalysisResult> {
  const started = performance.now();

  if (isImageMimeOrName(file.type, file.name)) {
    return {
      profile: 'SCANNED',
      complexLayout: false,
      hasNativeTextLayer: false,
      pageCount: 1,
      sampleText: '',
      analysisMs: Math.round(performance.now() - started),
    };
  }

  if (!isPdfMimeOrName(file.type, file.name)) {
    return {
      profile: 'SCANNED',
      complexLayout: false,
      hasNativeTextLayer: false,
      pageCount: 0,
      sampleText: '',
      analysisMs: Math.round(performance.now() - started),
    };
  }

  const headerBytes = new Uint8Array(await file.slice(0, 512_000).arrayBuffer());
  const hasNativeTextLayer = scanPdfDictionaryForTextLayer(headerBytes);

  let sampleText = '';
  let pageCount = 0;

  if (hasNativeTextLayer) {
    const sample = await extractSamplePagesText(file, SAMPLE_PAGE_LIMIT);
    sampleText = sample.text;
    pageCount = sample.pageCount;
  } else {
    try {
      const { loadPdfDocument } = await import('../pdf/pdfRender');
      const pdf = await loadPdfDocument(file);
      pageCount = pdf.numPages;
    } catch {
      pageCount = 0;
    }
  }

  const profile: DocumentProfile = hasNativeTextLayer && sampleText.trim().length > 40 ? 'NATIVE' : 'SCANNED';
  const complexLayout = profile === 'NATIVE' ? detectComplexLayout(sampleText) : false;

  return {
    profile,
    complexLayout,
    hasNativeTextLayer,
    pageCount,
    sampleText,
    analysisMs: Math.round(performance.now() - started),
  };
}

/** Synchronous-style layout heuristics with a 300ms budget before OCR/routing begins. */
export async function analyzeDocumentLayout(file: File): Promise<LayoutAnalysisResult> {
  const started = performance.now();

  try {
    const result = await Promise.race([
      analyzeDocumentLayoutInternal(file),
      new Promise<LayoutAnalysisResult>((_, reject) => {
        window.setTimeout(() => reject(new Error('layout-analysis-timeout')), ANALYSIS_BUDGET_MS);
      }),
    ]);
    return result;
  } catch {
    const headerBytes = new Uint8Array(await file.slice(0, 256_000).arrayBuffer());
    const hasNativeTextLayer = isPdfMimeOrName(file.type, file.name)
      ? scanPdfDictionaryForTextLayer(headerBytes)
      : false;

    return {
      profile: isImageMimeOrName(file.type, file.name) || !hasNativeTextLayer ? 'SCANNED' : 'NATIVE',
      complexLayout: false,
      hasNativeTextLayer,
      pageCount: 0,
      sampleText: '',
      analysisMs: Math.round(performance.now() - started),
    };
  }
}

export function isLargeScannedDocument(
  file: File,
  pageCount: number,
  profile: DocumentProfile,
): boolean {
  if (profile !== 'SCANNED') return false;
  const tenMb = 10 * 1024 * 1024;
  return pageCount > 5 || file.size > tenMb;
}
