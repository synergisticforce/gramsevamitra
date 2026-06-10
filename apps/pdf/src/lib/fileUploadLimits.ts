import {
  COMPUTER_MAX_BYTES,
  MOBILE_MAX_BYTES,
  isMobileDevice,
} from './deviceDetection';

export const MOBILE_LIMIT_MESSAGE =
  'File too large for a mobile phone. To safely process files up to 2GB, please open GramSeva Mitra on a computer or laptop.';

export const COMPUTER_LIMIT_MESSAGE =
  'Maximum browser limit reached. Files cannot exceed 2GB.';

export function getUploadLimitMessage(bytes: number): string | null {
  if (isMobileDevice() && bytes > MOBILE_MAX_BYTES) {
    return MOBILE_LIMIT_MESSAGE;
  }
  if (!isMobileDevice() && bytes > COMPUTER_MAX_BYTES) {
    return COMPUTER_LIMIT_MESSAGE;
  }
  return null;
}

export function validateUploadFile(
  file: File
): { ok: true; file: File } | { ok: false; message: string } {
  const message = getUploadLimitMessage(file.size);
  if (message) return { ok: false, message };
  return { ok: true, file };
}

/**
 * Validates every file before any buffer allocation. Rejects the whole batch
 * if any single file exceeds the device limit.
 */
export function validateUploadFiles(files: File[]): {
  accepted: File[];
  rejectedMessage: string | null;
} {
  for (const file of files) {
    const result = validateUploadFile(file);
    if (!result.ok) {
      return { accepted: [], rejectedMessage: result.message };
    }
  }
  return { accepted: files, rejectedMessage: null };
}
