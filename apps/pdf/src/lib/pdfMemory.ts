import { getUploadLimitMessage } from './fileUploadLimits';

export { getMaxUploadBytes } from './deviceDetection';

/** Explicitly drop large references so GC can reclaim between pipeline stages. */
export function releaseRef<T>(ref: { current: T | null } | T[] | null | undefined): void {
  if (ref == null) return;
  if (Array.isArray(ref)) {
    ref.length = 0;
    return;
  }
  if (typeof ref === 'object' && 'current' in ref) {
    ref.current = null;
  }
}

export function purgeUint8Array(buf: Uint8Array | null | undefined): null {
  if (buf) buf.fill(0);
  return null;
}

export function purgeArrayBuffers(buffers: ArrayBuffer[]): void {
  buffers.length = 0;
}

export async function yieldToGc(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

export const HEAVY_FILE_BYTES = 100 * 1024 * 1024;

export function isHeavyDocument(bytes: number): boolean {
  return bytes > HEAVY_FILE_BYTES;
}

export function assertSupportedFileSize(bytes: number): void {
  const message = getUploadLimitMessage(bytes);
  if (message) {
    throw new Error(message);
  }
}
