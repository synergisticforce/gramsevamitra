export const MOBILE_MAX_BYTES = 1024 * 1024 * 1024; // 1GB
export const COMPUTER_MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2GB

const MOBILE_UA_PATTERN =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

/**
 * Detect phones and tablets via userAgent — used to cap uploads at 1GB on mobile.
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua =
    navigator.userAgent ||
    navigator.vendor ||
    (typeof window !== 'undefined' &&
    'opera' in window &&
    typeof (window as Window & { opera?: string }).opera === 'string'
      ? (window as Window & { opera?: string }).opera
      : '') ||
    '';
  return MOBILE_UA_PATTERN.test(ua);
}

export function getMaxUploadBytes(): number {
  return isMobileDevice() ? MOBILE_MAX_BYTES : COMPUTER_MAX_BYTES;
}
