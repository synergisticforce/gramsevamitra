import { useEffect } from 'react';
import { consumePostSignOutRedirect } from '../../lib/auth/signOutState';
import {
  recoverFalseOfflinePage,
  recoverOfflineMisrouteDuringSignOut,
  shouldSuppressNetworkError,
} from '../../lib/network/offlineNetworkGuard';

/**
 * Suppress false "offline" flashes when sign-out aborts in-flight session fetches
 * or when auth APIs return 401/403 for logged-out users.
 */
export default function OfflineNetworkGuard() {
  useEffect(() => {
    if (consumePostSignOutRedirect() && window.location.pathname.startsWith('/offline')) {
      window.location.replace('/');
      return;
    }

    recoverOfflineMisrouteDuringSignOut();
    recoverFalseOfflinePage();

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!shouldSuppressNetworkError(event.reason)) return;
      event.preventDefault();
    };

    const onError = (event: ErrorEvent) => {
      if (!shouldSuppressNetworkError(event.error ?? event.message)) return;
      event.preventDefault();
    };

    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener('error', onError, true);

    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onError, true);
    };
  }, []);

  return null;
}
