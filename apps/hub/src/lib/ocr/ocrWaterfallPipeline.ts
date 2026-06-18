import { openProUpgrade } from '@shared/lib/proUpgrade';
import { OCR_WATERFALL_LOADER_STAGES } from '@shared/utils/ocrQuality';
import { parseCreditApiError } from '../auth/creditCheck';
import { prepareSmartExtractUpload } from '../canvas/smartExtractPrep';
import { runTier1TesseractOcr, type Tier1OcrResult } from './tesseractTier1';

export interface OcrWaterfallProgress {
  label: string;
  percent: number;
}

export interface OcrWaterfallResult {
  csv?: string;
  fileName: string;
  text?: string;
  processingMs?: number;
  remainingCredits?: number;
  pipeline?: unknown[];
  stages?: string[];
  usedVision?: boolean;
}

export class OcrProUpgradeRequiredError extends Error {
  readonly tier1: Tier1OcrResult;

  constructor(tier1: Tier1OcrResult) {
    super('Free OCR confidence was too low — Pro AI extraction is required.');
    this.name = 'OcrProUpgradeRequiredError';
    this.tier1 = tier1;
  }
}

const OCR_ORCHESTRATOR_ENDPOINT = '/api/pro/ocr-orchestrator';
const UPLOAD_ENDPOINT = '/api/pro/smart-extract/upload';

function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function postOcrOrchestrator(
  body: Record<string, unknown>,
  onProgress: (progress: OcrWaterfallProgress) => void,
): Promise<OcrWaterfallResult> {
  const serverStages = [
    OCR_WATERFALL_LOADER_STAGES.paddle,
    OCR_WATERFALL_LOADER_STAGES.glm,
    OCR_WATERFALL_LOADER_STAGES.vision,
    OCR_WATERFALL_LOADER_STAGES.finalize,
  ];

  let stageIndex = 0;
  onProgress({ label: serverStages[stageIndex], percent: 52 });
  const stageTimer = window.setInterval(() => {
    stageIndex = Math.min(serverStages.length - 1, stageIndex + 1);
    onProgress({
      label: serverStages[stageIndex],
      percent: Math.min(94, 52 + stageIndex * 10),
    });
  }, 2800);

  let response: Response;
  try {
    response = await fetch(OCR_ORCHESTRATOR_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } finally {
    window.clearInterval(stageTimer);
  }

  const payload = (await response.json()) as {
    success?: boolean;
    unreadable?: boolean;
    message?: string;
    output?: {
      format?: string;
      csv?: string;
      text?: string;
      fileName?: string;
      data?: unknown;
    };
    processingMs?: number;
    remainingCredits?: number;
    pipeline?: unknown[];
    stages?: string[];
    usedVision?: boolean;
    error?: string;
    requiredCredits?: number;
  };

  if (response.status === 401 || response.status === 403 || response.status === 402) {
    throw new Error(
      parseCreditApiError(response.status, payload, 'Pro subscription or credits required.'),
    );
  }

  if (payload.unreadable) {
    throw new Error(
      payload.message ??
        'Document text is completely unreadable. Please re-upload a sharper capture.',
    );
  }

  if (!response.ok || !payload.success || !payload.output) {
    throw new Error(parseCreditApiError(response.status, payload, 'OCR orchestrator failed.'));
  }

  const output = payload.output;
  const fileName =
    output.format === 'csv'
      ? output.fileName ?? 'extracted_data.csv'
      : `${(body.fileName as string | undefined)?.replace(/\.[^.]+$/, '') ?? 'extracted'}.txt`;

  onProgress({ label: OCR_WATERFALL_LOADER_STAGES.finalize, percent: 98 });

  if (output.format === 'csv' && output.csv) {
    downloadCsv(output.csv, fileName);
  } else if (output.text) {
    downloadText(output.text, fileName);
  }

  onProgress({ label: 'Complete', percent: 100 });

  return {
    csv: output.csv,
    text: output.text,
    fileName,
    processingMs: payload.processingMs,
    remainingCredits: payload.remainingCredits,
    pipeline: payload.pipeline,
    stages: payload.stages,
    usedVision: payload.usedVision,
  };
}

/**
 * Tier 1 (Tesseract) → optional Pro upgrade → Tier 2/3 OCR orchestrator.
 * @param options.requirePro When true, Tier 1 failure throws OcrProUpgradeRequiredError instead of opening UI directly.
 */
export async function runOcrWaterfallPipeline(
  file: File,
  onProgress: (progress: OcrWaterfallProgress) => void,
  options: { structuredTool?: boolean; documentType?: string; isPro?: boolean; skipTier1?: boolean; tier1Text?: string } = {},
): Promise<OcrWaterfallResult> {
  const plan = await prepareSmartExtractUpload(file, onProgress);

  if (plan.mode === 'text') {
    return postOcrOrchestrator(
      {
        tier1Text: plan.extractedText,
        fileName: plan.fileName,
        outputFormat: 'csv',
        documentType: options.documentType ?? 'invoice',
        structuredTool: options.structuredTool ?? true,
      },
      onProgress,
    );
  }

  let tier1Text = options.tier1Text ?? '';

  if (!options.skipTier1) {
    const tier1 = await runTier1TesseractOcr(file, (label, percent) =>
      onProgress({ label, percent: Math.round(percent * 0.45) }),
    );

    if (tier1.needsProHandoff && !options.isPro) {
      throw new OcrProUpgradeRequiredError(tier1);
    }
    tier1Text = tier1.text;
  }

  onProgress({ label: 'Uploading document to secure transient storage…', percent: 46 });
  const formData = new FormData();
  formData.append('file', plan.file);

  const uploadResponse = await fetch(UPLOAD_ENDPOINT, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  const uploadPayload = (await uploadResponse.json()) as {
    success?: boolean;
    objectKey?: string;
    fileName?: string;
    message?: string;
    error?: string;
    requiredCredits?: number;
  };

  if (uploadResponse.status === 401 || uploadResponse.status === 403 || uploadResponse.status === 402) {
    throw new Error(
      parseCreditApiError(uploadResponse.status, uploadPayload, 'Pro subscription or credits required.'),
    );
  }

  if (!uploadResponse.ok || !uploadPayload.success || !uploadPayload.objectKey) {
    throw new Error(
      parseCreditApiError(uploadResponse.status, uploadPayload, 'Failed to upload document for OCR.'),
    );
  }

  return postOcrOrchestrator(
    {
      objectKey: uploadPayload.objectKey,
      fileName: uploadPayload.fileName ?? plan.file.name,
      tier1Text,
      outputFormat: 'csv',
      documentType: options.documentType ?? 'invoice',
      structuredTool: options.structuredTool ?? true,
    },
    onProgress,
  );
}

export function promptProUpgradeAfterTier1Failure(tier1?: Tier1OcrResult): void {
  openProUpgrade({
    featureId: 'smart-document-extractor',
    featureName: 'Advanced AI OCR',
    featureDescription:
      tier1 && tier1.averageConfidence > 0
        ? `Free OCR confidence was ${Math.round(tier1.averageConfidence)}% on your sample pages — below our 65% quality bar. Upgrade to Pro for Paddle OCR + GLM layout reconstruction.`
        : 'This scan needs Pro AI OCR (Paddle + GLM + Vision fallback) for reliable extraction.',
  });
}
