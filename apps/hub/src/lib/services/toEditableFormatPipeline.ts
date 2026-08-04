import { openProUpgrade } from '@shared/lib/proUpgrade';
import { apiUrl } from '../../shared/lib/apiBase';
import { parseCreditApiError } from '../auth/creditCheck';
import { textToDocxBlob, triggerDocxDownload } from '../canvas/extractToWord';
import { htmlToDocxBlob } from '../canvas/htmlToDocx';
import { htmlToCsv, htmlToXml } from '../canvas/htmlToStructured';
import {
  extractPdfTextInBrowser,
  isPdfEmbeddedTextThin,
  isPdfMimeOrName,
  splitFilenameBase,
  triggerTextDownload,
} from '../canvas/documentPdfTools';
import { analyzeDocumentLayout, isLargeScannedDocument, type LayoutAnalysisResult } from './layoutAnalyzer';
import { runTesseractWithMemoryFlush, type Tier1OcrResult } from './tesseractWrapper';

export type EditableFormatTarget = 'txt' | 'md' | 'docx' | 'xlsx' | 'csv' | 'xml';

export interface ToEditableFormatProgress {
  label: string;
  percent: number;
  subtitle?: string;
}

export class EditableFormatProRequiredError extends Error {
  readonly layout: LayoutAnalysisResult;
  readonly tier1?: Tier1OcrResult;

  constructor(message: string, layout: LayoutAnalysisResult, tier1?: Tier1OcrResult) {
    super(message);
    this.name = 'EditableFormatProRequiredError';
    this.layout = layout;
    this.tier1 = tier1;
  }
}

const PRO_LAYOUT_MESSAGE =
  'Advanced Layout Detected: This file contains structured table columns, multi-column metrics, or complex scan quality that require deep AI layout reconstruction. Upgrade to GramSeva Mitra Pro to perfectly preserve your text formatting grids, rows, and margins.';

const LAYOUT_HTML_ENDPOINT = apiUrl('/api/pro/document-layout-html');

export function isProStructuralFormat(target: EditableFormatTarget): boolean {
  return target === 'xlsx' || target === 'csv' || target === 'xml';
}

/**
 * Formats built from the real Gemini Vision layout HTML on-device.
 * `xlsx` is deliberately excluded — that engine is not wired up yet.
 */
export function isVisionStructuredFormat(target: EditableFormatTarget): boolean {
  return target === 'csv' || target === 'xml';
}

/** Vision layout-preserving Word export (Gemini HTML → client DOCX). */
export function isVisionDocxFormat(target: EditableFormatTarget): boolean {
  return target === 'docx';
}

export function isRawTextFormat(target: EditableFormatTarget): target is 'txt' | 'md' {
  return target === 'txt' || target === 'md';
}

export function promptProUpgradeForComplexLayout(): void {
  openProUpgrade({
    featureId: 'reconstruct-layout',
    featureName: 'Advanced Layout Reconstruction',
    featureDescription: PRO_LAYOUT_MESSAGE,
  });
}

function cleanEmbeddedText(raw: string): string {
  return raw
    .replace(/--- Page \d+ ---/g, '')
    .replace(/\(no text detected\)/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function fileExtensionForTarget(target: EditableFormatTarget): string {
  if (target === 'md') return 'md';
  if (target === 'docx') return 'docx';
  if (target === 'xlsx') return 'xlsx';
  if (target === 'csv') return 'csv';
  if (target === 'xml') return 'xml';
  return 'txt';
}

async function compileDocxOutput(text: string, fileName: string): Promise<void> {
  const blob = await textToDocxBlob(text, splitFilenameBase(fileName));
  triggerDocxDownload(blob, fileName);
}

function compileRawTextOutput(text: string, target: 'txt' | 'md', fileName: string): void {
  const base = splitFilenameBase(fileName);
  triggerTextDownload(text, `${base}.${target === 'md' ? 'md' : 'txt'}`);
}

function downloadTextFile(content: string, fileName: string, contentType: string): void {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function downloadBase64File(base64: string, fileName: string, contentType: string): void {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Extract plain text locally — never escalates to Pro (used for .txt / .md). */
async function extractRawTextLocally(
  file: File,
  onProgress: (progress: ToEditableFormatProgress) => void,
): Promise<{ text: string; viaOcr: boolean }> {
  if (isPdfMimeOrName(file.type, file.name)) {
    onProgress({ label: 'Reading text stream…', percent: 20 });
    const embedded = await extractPdfTextInBrowser(file, ({ current, total, label }) => {
      const percent = total > 0 ? 20 + Math.round((current / total) * 45) : 30;
      onProgress({ label, percent });
    });
    const text = cleanEmbeddedText(embedded.text);
    if (!isPdfEmbeddedTextThin(embedded.text, embedded.pageCount) && text.length > 0) {
      return { text, viaOcr: false };
    }
  }

  onProgress({ label: 'Running local OCR for plain text…', percent: 55 });
  const tier1 = await runTesseractWithMemoryFlush(file, (label, percent) => {
    onProgress({ label, percent: Math.max(55, Math.min(88, percent)) });
  });
  return { text: tier1.text, viaOcr: true };
}

async function uploadForProReconstruction(file: File): Promise<{ objectKey: string; fileName: string }> {
  const formData = new FormData();
  formData.append('file', file, file.name);

  const response = await fetch(apiUrl('/api/pro/reconstruct-layout/upload'), {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  const payload = (await response.json()) as {
    success?: boolean;
    objectKey?: string;
    fileName?: string;
    message?: string;
    error?: string;
  };

  if (!response.ok || !payload.objectKey) {
    throw new Error(parseCreditApiError(response.status, payload, 'Pro layout upload failed.'));
  }

  return { objectKey: payload.objectKey, fileName: payload.fileName ?? file.name };
}

interface VisionLayoutHtml {
  html: string;
  baseName: string;
  remainingCredits?: number;
}

/**
 * Single Gemini Vision call that reconstructs the page as layout HTML.
 * DOCX, CSV, and XML are all compiled from this one result on-device, so a
 * user is charged for at most one AI operation per file.
 */
async function fetchVisionLayoutHtml(
  file: File,
  onProgress: (progress: ToEditableFormatProgress) => void,
  compileLabel: string,
): Promise<VisionLayoutHtml> {
  onProgress({
    label: 'Vision AI reconstructing layout…',
    percent: 10,
    subtitle: 'Preserving headings, colors, tables, and spacing.',
  });

  const stages = [
    { label: 'Vision AI analyzing typography & structure…', percent: 28 },
    { label: 'Rebuilding HTML layout…', percent: 52 },
    { label: compileLabel, percent: 78 },
  ];
  let stageIndex = 0;
  onProgress(stages[stageIndex]);
  const stageTimer = window.setInterval(() => {
    stageIndex = Math.min(stages.length - 1, stageIndex + 1);
    onProgress(stages[stageIndex]);
  }, 2800);

  let response: Response;
  try {
    const formData = new FormData();
    formData.append('file', file, file.name);
    response = await fetch(LAYOUT_HTML_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Network error contacting Vision layout API: ${detail}`);
  } finally {
    window.clearInterval(stageTimer);
  }

  let payload: {
    success?: boolean;
    html?: string;
    fileName?: string;
    remainingCredits?: number;
    message?: string;
    error?: string;
    detail?: string;
    code?: string;
    requiredCredits?: number;
  };

  try {
    payload = (await response.json()) as typeof payload;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Layout reconstruction failed: server returned non-JSON (HTTP ${response.status}). ${detail}`,
    );
  }

  if (response.status === 401 || response.status === 403) {
    promptProUpgradeForComplexLayout();
    throw new Error(
      parseCreditApiError(
        response.status,
        payload,
        'Pro subscription required for layout-perfect export.',
      ),
    );
  }

  if (!response.ok || !payload.success || typeof payload.html !== 'string') {
    throw new Error(
      parseCreditApiError(
        response.status,
        payload,
        `Layout reconstruction failed (HTTP ${response.status}).`,
      ),
    );
  }

  return {
    html: payload.html,
    baseName: splitFilenameBase(payload.fileName || file.name),
    remainingCredits: payload.remainingCredits,
  };
}

/**
 * Pro .docx path: Gemini Vision reconstructs HTML layout, then the browser
 * builds a styled Word file with the local `docx` library.
 */
export async function runVisionDocxExport(
  file: File,
  onProgress: (progress: ToEditableFormatProgress) => void,
): Promise<{ fileName: string; remainingCredits?: number }> {
  const { html, baseName, remainingCredits } = await fetchVisionLayoutHtml(
    file,
    onProgress,
    'Compiling formatted Word document…',
  );

  onProgress({ label: 'Building styled Word document…', percent: 90 });
  try {
    const blob = await htmlToDocxBlob(html, baseName);
    triggerDocxDownload(blob, `${baseName}.docx`);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`HTML-to-DOCX conversion failed: ${detail}`);
  }
  onProgress({ label: 'Download started', percent: 100 });

  return { fileName: `${baseName}.docx`, remainingCredits };
}

/**
 * Pro .csv / .xml path: the same Vision layout HTML, converted to structured
 * rows in the browser. Tables keep their row/column shape.
 */
export async function runVisionStructuredExport(
  file: File,
  target: 'csv' | 'xml',
  onProgress: (progress: ToEditableFormatProgress) => void,
): Promise<{ fileName: string; remainingCredits?: number }> {
  const { html, baseName, remainingCredits } = await fetchVisionLayoutHtml(
    file,
    onProgress,
    target === 'csv' ? 'Extracting table rows…' : 'Building XML structure…',
  );

  onProgress({
    label: target === 'csv' ? 'Building spreadsheet rows…' : 'Building XML document…',
    percent: 90,
  });

  const fileName = `${baseName}.${target}`;
  try {
    const content = target === 'csv' ? htmlToCsv(html) : htmlToXml(html);
    const contentType =
      target === 'csv' ? 'text/csv;charset=utf-8' : 'application/xml;charset=utf-8';
    downloadTextFile(content, fileName, contentType);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Structured export failed: ${detail}`);
  }

  onProgress({ label: 'Download started', percent: 100 });
  return { fileName, remainingCredits };
}

export async function runProLayoutReconstruction(
  file: File,
  target: EditableFormatTarget,
  onProgress: (progress: ToEditableFormatProgress) => void,
): Promise<{ fileName: string; remainingCredits?: number }> {
  if (target === 'docx') {
    return runVisionDocxExport(file, onProgress);
  }

  if (target === 'csv' || target === 'xml') {
    return runVisionStructuredExport(file, target, onProgress);
  }

  onProgress({ label: 'Uploading for secure layout reconstruction…', percent: 8 });
  const { objectKey, fileName } = await uploadForProReconstruction(file);

  const stages = [
    { label: 'Analyzing layout bounds…', percent: 25 },
    { label: 'Parsing structural tables…', percent: 55 },
    { label: 'Rebuilding native margins…', percent: 78 },
  ];

  let stageIndex = 0;
  onProgress(stages[stageIndex]);
  const stageTimer = window.setInterval(() => {
    stageIndex = Math.min(stages.length - 1, stageIndex + 1);
    onProgress(stages[stageIndex]);
  }, 3200);

  let response: Response;
  try {
    response = await fetch(apiUrl('/api/pro/reconstruct-layout'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objectKey, fileName, outputFormat: target }),
    });
  } finally {
    window.clearInterval(stageTimer);
  }

  const payload = (await response.json()) as {
    success?: boolean;
    fileName?: string;
    contentType?: string;
    fileBase64?: string;
    remainingCredits?: number;
    message?: string;
    error?: string;
  };

  if (!response.ok || !payload.fileBase64 || !payload.fileName) {
    throw new Error(parseCreditApiError(response.status, payload, 'Layout reconstruction failed.'));
  }

  downloadBase64File(payload.fileBase64, payload.fileName, payload.contentType ?? 'application/octet-stream');
  onProgress({ label: 'Download ready', percent: 100 });

  return { fileName: payload.fileName, remainingCredits: payload.remainingCredits };
}

export interface RunToEditableFormatOptions {
  isPro: boolean;
  onProgress: (progress: ToEditableFormatProgress) => void;
  onLargeFileNotice?: (visible: boolean) => void;
  autoPromptPro?: boolean;
  /** When true, Pro .docx always uses Gemini layout HTML → client DOCX. */
  preferVisionDocx?: boolean;
}

export async function runToEditableFormatPipeline(
  file: File,
  target: EditableFormatTarget,
  options: RunToEditableFormatOptions,
): Promise<{ path: 'A' | 'B' | 'C'; fileName: string }> {
  const {
    isPro,
    onProgress,
    onLargeFileNotice,
    autoPromptPro = true,
    preferVisionDocx = true,
  } = options;

  onProgress({ label: 'Analyzing document structure…', percent: 4 });
  const layout = await analyzeDocumentLayout(file);

  if (target === 'xlsx') {
    throw new Error(
      'Excel (.xlsx) export is coming soon. Choose .csv for spreadsheet data — it opens directly in Excel and Google Sheets.',
    );
  }

  if (isProStructuralFormat(target)) {
    if (!isPro) {
      if (autoPromptPro) promptProUpgradeForComplexLayout();
      throw new EditableFormatProRequiredError(
        `${target.toUpperCase()} export requires Pro layout reconstruction.`,
        layout,
      );
    }
    const result = await runProLayoutReconstruction(file, target, onProgress);
    return { path: 'C', fileName: result.fileName };
  }

  // Pro .docx → Gemini visual layout HTML, then local styled DOCX download.
  if (isVisionDocxFormat(target) && isPro && preferVisionDocx) {
    const result = await runVisionDocxExport(file, onProgress);
    return { path: 'C', fileName: result.fileName };
  }

  if (isRawTextFormat(target)) {
    const largeScan = isLargeScannedDocument(file, layout.pageCount, layout.profile);
    onLargeFileNotice?.(largeScan);
    if (largeScan) {
      onProgress({
        label: 'Extracting plain text…',
        percent: 12,
        subtitle:
          'Large file processing. Local conversion is completely free but will take a few minutes. Please keep this tab open.',
      });
    }

    const { text, viaOcr } = await extractRawTextLocally(file, onProgress);
    onProgress({ label: `Building ${target === 'md' ? 'Markdown' : 'text'} file…`, percent: 92 });
    compileRawTextOutput(text || '(no text detected)', target, file.name);
    onProgress({ label: 'Download started', percent: 100 });
    return {
      path: viaOcr ? 'B' : 'A',
      fileName: `${splitFilenameBase(file.name)}.${fileExtensionForTarget(target)}`,
    };
  }

  if (layout.profile === 'NATIVE' && layout.complexLayout) {
    if (!isPro) {
      if (autoPromptPro) promptProUpgradeForComplexLayout();
      throw new EditableFormatProRequiredError('Complex native layout requires Pro reconstruction.', layout);
    }
    const result = await runProLayoutReconstruction(file, target, onProgress);
    return { path: 'C', fileName: result.fileName };
  }

  if (layout.profile === 'NATIVE' && !layout.complexLayout) {
    onProgress({ label: 'Reading embedded text layer…', percent: 18 });
    const embedded = await extractPdfTextInBrowser(file, ({ current, total, label }) => {
      const percent = total > 0 ? 18 + Math.round((current / total) * 52) : 30;
      onProgress({ label, percent });
    });

    const text = cleanEmbeddedText(embedded.text);
    if (!isPdfEmbeddedTextThin(embedded.text, embedded.pageCount) && text.length > 0) {
      onProgress({ label: 'Building Word document…', percent: 88 });
      await compileDocxOutput(text, file.name);
      onProgress({ label: 'Download started', percent: 100 });
      return {
        path: 'A',
        fileName: `${splitFilenameBase(file.name)}.docx`,
      };
    }
  }

  const largeScan = isLargeScannedDocument(file, layout.pageCount, 'SCANNED');
  onLargeFileNotice?.(largeScan);

  onProgress({
    label: 'Enhancing scan for local OCR…',
    percent: 22,
    subtitle: largeScan
      ? 'Large file processing. Local conversion is completely free but will take a few minutes. Please keep this tab open.'
      : undefined,
  });

  const tier1 = await runTesseractWithMemoryFlush(file, (label, percent) => {
    onProgress({ label, percent: Math.max(25, Math.min(82, percent)) });
  });

  if (tier1.needsProHandoff) {
    if (!isPro) {
      if (autoPromptPro) promptProUpgradeForComplexLayout();
      throw new EditableFormatProRequiredError('Scan quality requires Pro layout reconstruction.', layout, tier1);
    }
    const result = await runProLayoutReconstruction(file, 'docx', onProgress);
    return { path: 'C', fileName: result.fileName };
  }

  onProgress({ label: 'Building Word document…', percent: 90 });
  await compileDocxOutput(tier1.text, file.name);
  onProgress({ label: 'Download started', percent: 100 });

  return {
    path: 'B',
    fileName: `${splitFilenameBase(file.name)}.docx`,
  };
}
