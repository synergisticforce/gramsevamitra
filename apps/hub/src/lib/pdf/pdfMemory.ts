import { getUploadLimitMessage } from './fileUploadLimits';

export { getMaxUploadBytes } from './deviceDetection';

export async function yieldToGc(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

export function assertSupportedFileSize(bytes: number): void {
  const message = getUploadLimitMessage(bytes);
  if (message) {
    throw new Error(message);
  }
}
