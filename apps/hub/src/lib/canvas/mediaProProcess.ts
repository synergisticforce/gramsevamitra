import { downloadBlob } from '@shared/utils/fileUtils';
import { splitImageBaseName } from './mediaImageTools';

export type MediaProAction = 'remove-bg' | 'upscale' | 'restore';

export interface MediaProProgress {
  label: string;
  percent: number;
}

export interface MediaProResult {
  blob: Blob;
  fileName: string;
  action: MediaProAction;
  processingMs?: number;
}

const TOOLBAR_TO_API: Record<string, MediaProAction> = {
  'remove-background': 'remove-bg',
  'upscale-4x': 'upscale',
  'photo-restore': 'restore',
};

export function resolveMediaProAction(actionId: string): MediaProAction | null {
  return TOOLBAR_TO_API[actionId] ?? null;
}

import { parseCreditApiError } from '../auth/creditCheck';

function outputFilenameForAction(file: File, action: MediaProAction): string {
  const base = splitImageBaseName(file.name);
  if (action === 'remove-bg') {
    return `${base}_no_bg.png`;
  }
  if (action === 'restore') {
    return `${base}_restored.jpg`;
  }
  return `${base}_upscaled.png`;
}

function toolSuffixForAction(action: MediaProAction): '_no_bg' | '_upscaled' | '_restored' {
  if (action === 'remove-bg') return '_no_bg';
  if (action === 'restore') return '_restored';
  return '_upscaled';
}

function startGpuProgressTicker(
  action: MediaProAction,
  onProgress: (progress: MediaProProgress) => void
): () => void {
  const label =
    action === 'remove-bg'
      ? 'Running serverless background removal…'
      : action === 'restore'
        ? 'Running AI photo restoration…'
        : 'Running serverless 4× upscale…';
  let percent = 55;
  onProgress({ label, percent });
  const timer = window.setInterval(() => {
    percent = Math.min(92, percent + 2);
    onProgress({ label, percent });
  }, 600);
  return () => window.clearInterval(timer);
}

export function triggerProMediaDownload(
  blob: Blob,
  filename: string,
  action: MediaProAction
): void {
  downloadBlob(blob, filename, toolSuffixForAction(action));
}

export async function runMediaProPipeline(
  file: File,
  action: MediaProAction,
  onProgress: (progress: MediaProProgress) => void
): Promise<MediaProResult> {
  onProgress({ label: 'Uploading image to secure transient storage…', percent: 8 });

  const formData = new FormData();
  formData.append('file', file);

  const uploadResponse = await fetch('/api/pro/media-process/upload', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  let uploadPayload: { success?: boolean; objectKey?: string; fileName?: string; message?: string; error?: string };
  try {
    uploadPayload = (await uploadResponse.json()) as typeof uploadPayload;
  } catch {
    throw new Error('Failed to upload image for processing.');
  }

  if (uploadResponse.status === 401 || uploadResponse.status === 403 || uploadResponse.status === 402) {
    throw new Error(parseCreditApiError(uploadResponse.status, uploadPayload, 'Pro subscription required.'));
  }

  if (!uploadResponse.ok || !uploadPayload.success || !uploadPayload.objectKey) {
    throw new Error(parseCreditApiError(uploadResponse.status, uploadPayload, 'Failed to upload image for processing.'));
  }

  onProgress({ label: 'Upload complete — initiating GPU processing…', percent: 38 });

  const stopTicker = startGpuProgressTicker(action, onProgress);

  let processResponse: Response;
  try {
    processResponse = await fetch('/api/pro/media-process', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        objectKey: uploadPayload.objectKey,
        fileName: uploadPayload.fileName ?? file.name,
        action,
      }),
    });
  } finally {
    stopTicker();
  }

  if (processResponse.status === 401 || processResponse.status === 403 || processResponse.status === 402) {
    let payload: { message?: string; error?: string; requiredCredits?: number; remainingCredits?: number } = {};
    try {
      payload = (await processResponse.json()) as typeof payload;
    } catch {
      /* binary error unlikely */
    }
    throw new Error(parseCreditApiError(processResponse.status, payload, 'Pro subscription required.'));
  }

  if (!processResponse.ok) {
    let payload: { message?: string; error?: string } = {};
    try {
      payload = (await processResponse.json()) as typeof payload;
    } catch {
      /* ignore */
    }
    throw new Error(parseCreditApiError(processResponse.status, payload, 'Media processing failed.'));
  }

  onProgress({ label: 'Preparing download…', percent: 96 });

  const blob = await processResponse.blob();
  const headerName = processResponse.headers.get('X-GSM-File-Name');
  const fileName = headerName || outputFilenameForAction(file, action);
  const processingMs = Number(processResponse.headers.get('X-GSM-Processing-Ms') || '0') || undefined;

  triggerProMediaDownload(blob, fileName, action);
  onProgress({ label: 'Complete', percent: 100 });

  return { blob, fileName, action, processingMs };
}
