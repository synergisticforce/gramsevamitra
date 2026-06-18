export const MOBILE_MAX_BYTES = 1024 * 1024 * 1024;
export const COMPUTER_MAX_BYTES = 2 * 1024 * 1024 * 1024;

/** Safe in-browser PDF processing before Smart Slicing kicks in. */
export const MOBILE_TABLET_LOCAL_BYTES = 50 * 1024 * 1024;
export const DESKTOP_LOCAL_BYTES = 1024 * 1024 * 1024;

const MOBILE_UA_PATTERN =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

function navigatorUserAgent(): string {
  if (typeof navigator === 'undefined') return '';
  return (
    navigator.userAgent ||
    navigator.vendor ||
    (typeof window !== 'undefined' &&
    'opera' in window &&
    typeof (window as Window & { opera?: string }).opera === 'string'
      ? (window as Window & { opera?: string }).opera
      : '') ||
    ''
  );
}

/** Phones, tablets, and iPadOS devices that report a desktop user agent. */
export function isMobileOrTablet(): boolean {
  const ua = navigatorUserAgent();
  if (MOBILE_UA_PATTERN.test(ua)) return true;

  const maxTouch = typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0;
  if (maxTouch > 1 && /Macintosh|Mac OS X/i.test(ua)) return true;

  return false;
}

export function isMobileDevice(): boolean {
  return isMobileOrTablet();
}

export function getLocalProcessingLimitBytes(): number {
  return isMobileOrTablet() ? MOBILE_TABLET_LOCAL_BYTES : DESKTOP_LOCAL_BYTES;
}

export function getMaxUploadBytes(): number {
  return isMobileDevice() ? MOBILE_MAX_BYTES : COMPUTER_MAX_BYTES;
}
