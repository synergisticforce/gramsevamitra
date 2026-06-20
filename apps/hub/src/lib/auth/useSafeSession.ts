import { useEffect, useState } from 'react';
import { authClient } from '@gramsevamitra/auth/client';

/** Fail open to logged-out if Better Auth never responds (shared-device / SW edge cases). */
const SESSION_PROBE_TIMEOUT_MS = 8_000;

export function useSafeSession() {
  const { data: session, isPending, error, isRefetching } = authClient.useSession();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!isPending) {
      setTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => setTimedOut(true), SESSION_PROBE_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [isPending]);

  const authUnavailable = Boolean(error) || timedOut;
  const user = authUnavailable ? undefined : session?.user;
  const isChecking = isPending && !timedOut && !error;

  return {
    session: authUnavailable ? null : session,
    user,
    isPending: isChecking,
    isRefetching,
    isLoggedOut: !isChecking && !user,
    authUnavailable,
    error,
  };
}
