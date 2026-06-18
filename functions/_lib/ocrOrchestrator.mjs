import {
  callGoogleCloudVision,
  callGlmOcr,
  callPaddleOcr,
  structuredDataToCsv,
} from './ocrEngines.mjs';

export const OCR_PADDLE_WORD_CONFIDENCE_MIN = 80;
export const OCR_GLM_INFERENCE_MAX_MS = 30_000;
export const OCR_GLM_COLD_START_GRACE_MS = 12_000;

export const OCR_LOADER_STAGES = {
  paddle: 'Parsing layout matrix…',
  glm: 'Applying deep AI reconstruction…',
  vision: 'Applying premium vision fallback…',
  finalize: 'Finalizing extraction…',
};

const UNREADABLE_MESSAGE =
  'Document text is completely unreadable. Please re-upload a sharper capture.';

function layoutNeedsGlm(layoutFlags) {
  if (!layoutFlags) return false;
  return Boolean(
    layoutFlags.hasTable ||
      layoutFlags.hasKeyValue ||
      layoutFlags.hasMultiColumn ||
      layoutFlags.hasInvoiceLineItems ||
      layoutFlags.hasComplexForm,
  );
}

function glmBillableMs(glmResult) {
  const raw = glmResult.processingMs ?? 0;
  if (glmResult.wasColdStart) {
    return Math.max(0, raw - OCR_GLM_COLD_START_GRACE_MS);
  }
  return raw;
}

function glmNeedsVision(glmResult) {
  const billable = glmBillableMs(glmResult);
  if (billable > OCR_GLM_INFERENCE_MAX_MS) return 'glm_timeout';
  if (glmResult.schemaValid === false) return 'glm_broken_schema';
  return null;
}

/**
 * Master OCR waterfall — Tier 2 (Paddle → GLM) with Tier 3 Vision failsafe.
 * Tier 1 Tesseract runs client-side before this endpoint is invoked.
 *
 * @param {{
 *   objectKey?: string;
 *   fileName?: string;
 *   outputFormat?: string;
 *   documentType?: string;
 *   structuredTool?: boolean;
 *   tier1Text?: string;
 *   forceFailsafe?: boolean;
 *   simulateUnreadable?: boolean;
 * }} input
 */
export async function runOcrOrchestrator(input) {
  const outputFormat = (input.outputFormat ?? 'csv').toLowerCase();
  const documentType = input.documentType ?? 'invoice';
  const structuredTool = Boolean(input.structuredTool);
  const forceFailsafe = Boolean(input.forceFailsafe);
  const pipeline = [];
  const stages = [];

  const isStructuredOutput =
    structuredTool || outputFormat === 'json' || outputFormat === 'csv' || outputFormat === 'docx';

  stages.push(OCR_LOADER_STAGES.paddle);
  const paddle = await callPaddleOcr({
    fileName: input.fileName,
    documentType,
    forceLowConfidence: forceFailsafe,
  });
  pipeline.push({ tier: '2a', step: 'paddleocr', result: paddle });

  const paddleLowConfidence = paddle.averageWordConfidence < OCR_PADDLE_WORD_CONFIDENCE_MIN;
  const layoutStructured = layoutNeedsGlm(paddle.layoutFlags);
  const needsGlm = isStructuredOutput || paddleLowConfidence || layoutStructured || structuredTool;

  let structured = null;
  let flatText = paddle.flatText || input.tier1Text || '';
  let usedVision = false;

  if (needsGlm) {
    stages.push(OCR_LOADER_STAGES.glm);
    const glm = await callGlmOcr({
      mode: outputFormat === 'docx' ? 'layout' : 'extract',
      blocks: paddle.blocks,
      documentType,
      outputFormat,
      forceSlowInference: forceFailsafe && input.simulateUnreadable !== true,
      forceBrokenSchema: forceFailsafe && outputFormat === 'json',
    });
    pipeline.push({ tier: '2b', step: 'glm-ocr', result: glm });

    const visionReason = glmNeedsVision(glm);
    if (visionReason || forceFailsafe) {
      stages.push(OCR_LOADER_STAGES.vision);
      const vision = await callGoogleCloudVision({
        reason: visionReason ?? (forceFailsafe ? 'forced_test' : 'glm_failure'),
        simulateUnreadable: Boolean(input.simulateUnreadable),
      });
      pipeline.push({ tier: '3', step: 'google-cloud-vision', result: vision });
      usedVision = true;

      if (vision.unreadable || !vision.text?.trim()) {
        return {
          ok: false,
          status: 422,
          body: {
            success: false,
            unreadable: true,
            message: UNREADABLE_MESSAGE,
            pipeline,
            stages,
          },
        };
      }

      flatText = vision.text;
      structured = vision.structured ?? glm.structured;
    } else if (glm.schemaValid) {
      structured = glm.structured;
      if (outputFormat === 'docx') {
        structured = { ...structured, hierarchy: glm.hierarchy };
      }
    }
  }

  stages.push(OCR_LOADER_STAGES.finalize);

  let output;
  if (outputFormat === 'json') {
    output = { format: 'json', data: structured ?? { text: flatText } };
  } else if (outputFormat === 'docx') {
    output = {
      format: 'docx',
      fileName: `${(input.fileName ?? 'document').replace(/\.[^.]+$/, '')}.docx`,
      mockDownloadToken: `ocr-docx-${Date.now()}`,
      hierarchy: structured?.hierarchy,
    };
  } else if (outputFormat === 'text') {
    output = { format: 'text', text: flatText };
  } else {
    output = {
      format: 'csv',
      csv: structuredDataToCsv(structured ?? {}),
      fileName: 'extracted_data.csv',
    };
  }

  return {
    ok: true,
    body: {
      success: true,
      pipeline,
      stages,
      usedVision,
      tier1Bypassed: Boolean(input.tier1Text),
      output,
      processingMs: pipeline.reduce((sum, step) => sum + (step.result?.processingMs ?? 0), 0),
      sourceFile: input.fileName ?? 'document',
      objectKey: input.objectKey,
    },
  };
}
