import { useEffect } from 'react';
import {
  recoverOfflineMisrouteDuringSignOut,
  shouldSuppressNetworkError,
} from '../../lib/network/offlineNetworkGuard';

/**
 * Suppress false "offline" flashes when sign-out aborts in-flight session fetches.
 */
export default function OfflineNetworkGuard() {
  useEffect(() => {
    recoverOfflineMisrouteDuringSignOut();

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
