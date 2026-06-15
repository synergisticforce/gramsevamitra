import { parseCreditApiError } from '../auth/creditCheck';
import { prepareSmartExtractUpload } from './smartExtractPrep';

export interface SmartExtractProgress {
  label: string;
  percent: number;
}

export interface SmartExtractResult {
  csv: string;
  fileName: string;
  processingMs?: number;
  remainingCredits?: number;
}

const EXTRACT_ENDPOINT = '/api/pro/extract';
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

function startExtractProgressTicker(
  onProgress: (progress: SmartExtractProgress) => void,
): () => void {
  let percent = 55;
  onProgress({ label: 'Running advanced AI extraction…', percent });
  const timer = window.setInterval(() => {
    percent = Math.min(92, percent + 2);
    onProgress({ label: 'Running advanced AI extraction…', percent });
  }, 600);
  return () => window.clearInterval(timer);
}

async function postExtractRequest(
  body: Record<string, unknown>,
  onProgress: (progress: SmartExtractProgress) => void,
): Promise<SmartExtractResult> {
  const stopTicker = startExtractProgressTicker(onProgress);

  let extractResponse: Response;
  try {
    extractResponse = await fetch(EXTRACT_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } finally {
    stopTicker();
  }

  const extractPayload = (await extractResponse.json()) as {
    success?: boolean;
    csv?: string;
    fileName?: string;
    processingMs?: number;
    remainingCredits?: number;
    message?: string;
    error?: string;
    requiredCredits?: number;
  };

  if (extractResponse.status === 401 || extractResponse.status === 403 || extractResponse.status === 402) {
    throw new Error(
      parseCreditApiError(extractResponse.status, extractPayload, 'Pro subscription or credits required.'),
    );
  }

  if (!extractResponse.ok || !extractPayload.success || !extractPayload.csv) {
    throw new Error(parseCreditApiError(extractResponse.status, extractPayload, 'Smart Extract processing failed.'));
  }

  onProgress({ label: 'Preparing CSV download…', percent: 98 });

  const fileName = extractPayload.fileName ?? 'extracted_data.csv';
  downloadCsv(extractPayload.csv, fileName);
  onProgress({ label: 'Complete', percent: 100 });

  return {
    csv: extractPayload.csv,
    fileName,
    processingMs: extractPayload.processingMs,
    remainingCredits: extractPayload.remainingCredits,
  };
}

export async function runSmartExtractPipeline(
  file: File,
  onProgress: (progress: SmartExtractProgress) => void,
): Promise<SmartExtractResult> {
  const plan = await prepareSmartExtractUpload(file, onProgress);

  if (plan.mode === 'text') {
    return postExtractRequest(
      {
        extractedText: plan.extractedText,
        fileName: plan.fileName,
      },
      onProgress,
    );
  }

  onProgress({ label: 'Uploading document to secure transient storage…', percent: 8 });

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
    remainingCredits?: number;
  };

  if (uploadResponse.status === 401 || uploadResponse.status === 403 || uploadResponse.status === 402) {
    throw new Error(
      parseCreditApiError(uploadResponse.status, uploadPayload, 'Pro subscription or credits required.'),
    );
  }

  if (!uploadResponse.ok || !uploadPayload.success || !uploadPayload.objectKey) {
    throw new Error(parseCreditApiError(uploadResponse.status, uploadPayload, 'Failed to upload document for processing.'));
  }

  onProgress({ label: 'Upload complete — initiating Smart Extract…', percent: 42 });

  return postExtractRequest(
    {
      objectKey: uploadPayload.objectKey,
      fileName: uploadPayload.fileName ?? plan.file.name,
    },
    onProgress,
  );
}
