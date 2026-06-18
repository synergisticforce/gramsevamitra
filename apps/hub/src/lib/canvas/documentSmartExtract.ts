import { parseCreditApiError } from '../auth/creditCheck';
import {
  OcrProUpgradeRequiredError,
  promptProUpgradeAfterTier1Failure,
  runOcrWaterfallPipeline,
} from '../ocr/ocrWaterfallPipeline';

export interface SmartExtractProgress {
  label: string;
  percent: number;
}

export interface SmartExtractResult {
  csv: string;
  fileName: string;
  processingMs?: number;
  remainingCredits?: number;
  usedVision?: boolean;
}

export { OcrProUpgradeRequiredError, promptProUpgradeAfterTier1Failure };

export async function runSmartExtractPipeline(
  file: File,
  onProgress: (progress: SmartExtractProgress) => void,
  options: { isPro?: boolean; skipTier1?: boolean; tier1Text?: string } = {},
): Promise<SmartExtractResult> {
  try {
    const result = await runOcrWaterfallPipeline(file, onProgress, {
      structuredTool: true,
      documentType: 'invoice',
      isPro: options.isPro,
      skipTier1: options.skipTier1,
      tier1Text: options.tier1Text,
    });

    if (!result.csv) {
      throw new Error('Smart Extract did not return CSV output.');
    }

    return {
      csv: result.csv,
      fileName: result.fileName,
      processingMs: result.processingMs,
      remainingCredits: result.remainingCredits,
      usedVision: result.usedVision,
    };
  } catch (err) {
    if (err instanceof OcrProUpgradeRequiredError) {
      promptProUpgradeAfterTier1Failure(err.tier1);
      throw err;
    }
    if (err instanceof Error) {
      throw err;
    }
    throw new Error(parseCreditApiError(500, {}, 'Smart Extract processing failed.'));
  }
}
