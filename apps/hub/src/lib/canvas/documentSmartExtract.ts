export interface SmartExtractProgress {
  label: string;
  percent: number;
}

export interface SmartExtractResult {
  csv: string;
  fileName: string;
  processingMs?: number;
}

function parseApiError(payload: { message?: string; error?: string }, fallback: string): string {
  return payload.message ?? payload.error ?? fallback;
}

function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Smooth progress while waiting on the mock GPU extract call. */
function startExtractProgressTicker(
  onProgress: (progress: SmartExtractProgress) => void
): () => void {
  let percent = 55;
  onProgress({ label: 'Running serverless GPU extraction…', percent });
  const timer = window.setInterval(() => {
    percent = Math.min(92, percent + 2);
    onProgress({ label: 'Running serverless GPU extraction…', percent });
  }, 600);
  return () => window.clearInterval(timer);
}

export async function runSmartExtractPipeline(
  file: File,
  onProgress: (progress: SmartExtractProgress) => void
): Promise<SmartExtractResult> {
  onProgress({ label: 'Uploading document to secure transient storage…', percent: 8 });

  const formData = new FormData();
  formData.append('file', file);

  const uploadResponse = await fetch('/api/pro/smart-extract/upload', {
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
  };

  if (uploadResponse.status === 401 || uploadResponse.status === 403) {
    throw new Error(parseApiError(uploadPayload, 'Pro subscription required.'));
  }

  if (!uploadResponse.ok || !uploadPayload.success || !uploadPayload.objectKey) {
    throw new Error(parseApiError(uploadPayload, 'Failed to upload document for processing.'));
  }

  onProgress({ label: 'Upload complete — initiating Smart Extract…', percent: 38 });

  const stopTicker = startExtractProgressTicker(onProgress);

  let extractResponse: Response;
  try {
    extractResponse = await fetch('/api/pro/smart-extract', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        objectKey: uploadPayload.objectKey,
        fileName: uploadPayload.fileName ?? file.name,
      }),
    });
  } finally {
    stopTicker();
  }

  const extractPayload = (await extractResponse.json()) as {
    success?: boolean;
    csv?: string;
    fileName?: string;
    processingMs?: number;
    message?: string;
    error?: string;
  };

  if (extractResponse.status === 401 || extractResponse.status === 403) {
    throw new Error(parseApiError(extractPayload, 'Pro subscription required.'));
  }

  if (!extractResponse.ok || !extractPayload.success || !extractPayload.csv) {
    throw new Error(parseApiError(extractPayload, 'Smart Extract processing failed.'));
  }

  onProgress({ label: 'Preparing CSV download…', percent: 98 });

  const fileName = extractPayload.fileName ?? 'extracted_data.csv';
  downloadCsv(extractPayload.csv, fileName);

  onProgress({ label: 'Complete', percent: 100 });

  return {
    csv: extractPayload.csv,
    fileName,
    processingMs: extractPayload.processingMs,
  };
}
