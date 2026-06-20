declare global {
  interface Window {
    /** Set while performSignOut runs — suppresses false offline / fetch-abort UI. */
    __isSigningOut?: boolean;
  }
}

/** Mark an in-progress sign-out before any navigation or storage wipe. */
export function markSigningOut(): void {
  if (typeof window === 'undefined') return;
  window.__isSigningOut = true;
}

export function isSigningOut(): boolean {
  return typeof window !== 'undefined' && window.__isSigningOut === true;
}
