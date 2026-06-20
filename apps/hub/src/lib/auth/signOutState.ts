declare global {
  interface Window {
    /** Set while performSignOut runs — suppresses false offline / fetch-abort UI. */
    __isSigningOut?: boolean;
  }
}

const POST_SIGN_OUT_KEY = 'gsm:post-sign-out';

/** Mark an in-progress sign-out before any navigation or storage wipe. */
export function markSigningOut(): void {
  if (typeof window === 'undefined') return;
  window.__isSigningOut = true;
}

export function isSigningOut(): boolean {
  return typeof window !== 'undefined' && window.__isSigningOut === true;
}

/** Survives storage wipe — used to recover from a false /offline landing after sign-out. */
export function markPostSignOutRedirect(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(POST_SIGN_OUT_KEY, '1');
  } catch {
    /* private browsing */
  }
}

export function consumePostSignOutRedirect(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem(POST_SIGN_OUT_KEY) !== '1') return false;
    localStorage.removeItem(POST_SIGN_OUT_KEY);
    return true;
  } catch {
    return false;
  }
}
