import { openProUpgrade } from '@shared/lib/proUpgrade';
import { parseCreditApiError } from '../auth/creditCheck';
import { textToDocxBlob } from '../canvas/extractToWord';
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

export function isProStructuralFormat(target: EditableFormatTarget): boolean {
  return target === 'xlsx' || target === 'csv' || target === 'xml';
}

export function isRawTextFormat(target: EditableFormatTarget): boolean {
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

function triggerDocxDownload(blob: Blob, baseName: string): void {
  const safe = splitFilenameBase(baseName).replace(/[^\w.-]+/g, '_') || 'extracted';
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safe}.docx`;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function compileRawTextOutput(text: string, target: 'txt' | 'md', fileName: string): void {
  const base = splitFilenameBase(fileName);
  triggerTextDownload(text, `${base}.${target === 'md' ? 'md' : 'txt'}`);
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

  const response = await fetch('/api/pro/reconstruct-layout/upload', {
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

export async function runProLayoutReconstruction(
  file: File,
  target: EditableFormatTarget,
  onProgress: (progress: ToEditableFormatProgress) => void,
): Promise<{ fileName: string; remainingCredits?: number }> {
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
    response = await fetch('/api/pro/reconstruct-layout', {
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
}

export async function runToEditableFormatPipeline(
  file: File,
  target: EditableFormatTarget,
  options: RunToEditableFormatOptions,
): Promise<{ path: 'A' | 'B' | 'C'; fileName: string }> {
  const { isPro, onProgress, onLargeFileNotice, autoPromptPro = true } = options;

  onProgress({ label: 'Analyzing document structure…', percent: 4 });
  const layout = await analyzeDocumentLayout(file);

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
