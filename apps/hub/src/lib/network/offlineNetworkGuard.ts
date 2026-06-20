import { isSigningOut } from '../auth/signOutState';

function isAbortError(reason: unknown): boolean {
  if (reason instanceof DOMException && reason.name === 'AbortError') return true;
  if (reason instanceof Error && reason.name === 'AbortError') return true;
  return false;
}

function isFailedFetchError(reason: unknown): boolean {
  if (!(reason instanceof Error)) return false;
  const message = reason.message.toLowerCase();
  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror when attempting to fetch') ||
    message.includes('network request failed') ||
    message.includes('load failed')
  );
}

/** Ignore fetch aborts caused by hard redirects during sign-out. */
export function shouldSuppressNetworkError(reason: unknown): boolean {
  if (!isSigningOut()) return false;
  return isAbortError(reason) || isFailedFetchError(reason);
}

/** Recover if the PWA offline fallback wins the race during sign-out. */
export function recoverOfflineMisrouteDuringSignOut(): void {
  if (typeof window === 'undefined' || !isSigningOut()) return;
  if (!window.location.pathname.startsWith('/offline')) return;
  window.location.replace('/?signIn=1');
}
