import { downloadBlob } from '@shared/utils/fileUtils';
import { splitFilenameBase } from './documentPdfTools';

export type HiFiOutputFormat = 'docx' | 'pptx';

export interface FileConverterProgress {
  label: string;
  percent: number;
}

export interface FileConverterResult {
  fileName: string;
  format: HiFiOutputFormat;
  processingMs?: number;
}

import { parseCreditApiError } from '../auth/creditCheck';

function startConverterProgressTicker(
  onProgress: (progress: FileConverterProgress) => void
): () => void {
  let percent = 55;
  onProgress({ label: 'Running high-fidelity conversion…', percent });
  const timer = window.setInterval(() => {
    percent = Math.min(92, percent + 2);
    onProgress({ label: 'Running high-fidelity conversion…', percent });
  }, 600);
  return () => window.clearInterval(timer);
}

function downloadConvertedFile(
  fileBase64: string,
  fileName: string,
  contentType: string
): void {
  const binary = atob(fileBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  downloadBlob(new Blob([bytes], { type: contentType }), fileName, '_converted');
}

export async function runFileConverterPipeline(
  file: File,
  format: HiFiOutputFormat,
  onProgress: (progress: FileConverterProgress) => void
): Promise<FileConverterResult> {
  onProgress({ label: 'Uploading PDF to secure transient storage…', percent: 8 });

  const formData = new FormData();
  formData.append('file', file);

  const uploadResponse = await fetch('/api/pro/file-converter/upload', {
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

  if (uploadResponse.status === 401 || uploadResponse.status === 403 || uploadResponse.status === 402) {
    throw new Error(parseCreditApiError(uploadResponse.status, uploadPayload, 'Pro subscription required.'));
  }

  if (!uploadResponse.ok || !uploadPayload.success || !uploadPayload.objectKey) {
    throw new Error(parseCreditApiError(uploadResponse.status, uploadPayload, 'Failed to upload document for conversion.'));
  }

  onProgress({ label: 'Upload complete — initiating conversion…', percent: 38 });

  const stopTicker = startConverterProgressTicker(onProgress);

  let convertResponse: Response;
  try {
    convertResponse = await fetch('/api/pro/file-converter', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        objectKey: uploadPayload.objectKey,
        fileName: uploadPayload.fileName ?? file.name,
        format,
      }),
    });
  } finally {
    stopTicker();
  }

  const convertPayload = (await convertResponse.json()) as {
    success?: boolean;
    format?: HiFiOutputFormat;
    fileName?: string;
    contentType?: string;
    fileBase64?: string;
    processingMs?: number;
    message?: string;
    error?: string;
  };

  if (convertResponse.status === 401 || convertResponse.status === 403 || convertResponse.status === 402) {
    throw new Error(parseCreditApiError(convertResponse.status, convertPayload, 'Pro subscription required.'));
  }

  if (
    !convertResponse.ok ||
    !convertPayload.success ||
    !convertPayload.fileBase64 ||
    !convertPayload.fileName
  ) {
    throw new Error(parseCreditApiError(convertResponse.status, convertPayload, 'High-fidelity conversion failed.'));
  }

  onProgress({ label: 'Preparing download…', percent: 98 });

  const fileName =
    convertPayload.fileName ??
    `${splitFilenameBase(file.name)}.${format === 'pptx' ? 'pptx' : 'docx'}`;
  const contentType =
    convertPayload.contentType ??
    (format === 'pptx'
      ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

  downloadConvertedFile(convertPayload.fileBase64, fileName, contentType);

  onProgress({ label: 'Complete', percent: 100 });

  return {
    fileName,
    format: convertPayload.format ?? format,
    processingMs: convertPayload.processingMs,
  };
}
