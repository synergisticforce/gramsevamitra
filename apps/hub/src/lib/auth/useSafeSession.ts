import { useEffect, useState } from 'react';
import { authClient } from '@gramsevamitra/auth/client';
import { getHttpStatusFromError, isAuthRejectionError } from '../network/offlineNetworkGuard';
import { isSigningOut } from './signOutState';

/** Fail open to logged-out if Better Auth never responds (shared-device / SW edge cases). */
const SESSION_PROBE_TIMEOUT_MS = 8_000;

function shouldIgnoreSessionError(error: unknown): boolean {
  if (isSigningOut()) return true;
  if (!error) return false;
  return isAuthRejectionError(error);
}

export function useSafeSession() {
  const { data: session, isPending, error, isRefetching } = authClient.useSession();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!isPending || isSigningOut()) {
      setTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => setTimedOut(true), SESSION_PROBE_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [isPending]);

  if (isSigningOut()) {
    return {
      session: null,
      user: undefined,
      isPending: false,
      isRefetching: false,
      isLoggedOut: true,
      authUnavailable: false,
      error: null,
    };
  }

  const authStatus = getHttpStatusFromError(error);
  const isLoggedOutAuthError = authStatus === 401 || authStatus === 403 || shouldIgnoreSessionError(error);
  const authUnavailable = (Boolean(error) && !isLoggedOutAuthError) || timedOut;
  const user = authUnavailable || isLoggedOutAuthError ? undefined : session?.user;
  const isChecking = isPending && !timedOut && !error;

  return {
    session: authUnavailable || isLoggedOutAuthError ? null : session,
    user,
    isPending: isChecking,
    isRefetching,
    isLoggedOut: !isChecking && !user,
    authUnavailable,
    error: isLoggedOutAuthError ? null : error,
  };
}
