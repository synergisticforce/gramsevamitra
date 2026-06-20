import { isSigningOut } from '../auth/signOutState';

const AUTH_REJECTION_STATUSES = new Set([401, 403]);

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

/** Extract HTTP status from Better Fetch / fetch wrapper errors. */
export function getHttpStatusFromError(reason: unknown): number | null {
  if (!reason || typeof reason !== 'object') return null;

  const record = reason as Record<string, unknown>;
  if (typeof record.status === 'number') return record.status;

  const nested = record.error;
  if (nested && typeof nested === 'object' && typeof (nested as Record<string, unknown>).status === 'number') {
    return (nested as Record<string, unknown>).status as number;
  }

  return null;
}

/** Session cleared — not a connectivity failure. */
export function isAuthRejectionError(reason: unknown): boolean {
  const status = getHttpStatusFromError(reason);
  if (status !== null && AUTH_REJECTION_STATUSES.has(status)) return true;

  if (reason instanceof Error) {
    const message = reason.message.toLowerCase();
    if (message.includes('unauthorized') || message.includes('forbidden')) return true;
  }

  return false;
}

/** Ignore errors that must not trigger offline UI or global error boundaries. */
export function shouldSuppressNetworkError(reason: unknown): boolean {
  if (isAuthRejectionError(reason)) return true;
  if (!isSigningOut()) return false;
  return isAbortError(reason) || isFailedFetchError(reason);
}

/** Recover if the PWA offline fallback wins the race during sign-out. */
export function recoverOfflineMisrouteDuringSignOut(): void {
  if (typeof window === 'undefined' || !isSigningOut()) return;
  if (!window.location.pathname.startsWith('/offline')) return;
  window.location.replace('/');
}

/** Bounce off the offline shell when the network is actually available. */
export function recoverFalseOfflinePage(): void {
  if (typeof window === 'undefined') return;
  if (!window.location.pathname.startsWith('/offline')) return;
  if (!navigator.onLine) return;
  window.location.replace('/');
}
