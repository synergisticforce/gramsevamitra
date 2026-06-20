import { useEffect, useState } from 'react';
import { authClient } from '@gramsevamitra/auth/client';
import { buildSignInRedirectUrl, stashAuthReturnTo } from '../../lib/auth/returnTo';

interface Props {
  requireAuth: boolean;
}

export default function WorkspaceAuthGate({ requireAuth }: Props) {
  const { data: session, isPending } = authClient.useSession();
  const [redirecting, setRedirecting] = useState(false);
  const isAuthenticated = Boolean(session?.user);

  useEffect(() => {
    if (!requireAuth || isPending || isAuthenticated) return;

    const returnPath = `${window.location.pathname}${window.location.search}`;
    stashAuthReturnTo(returnPath);
    setRedirecting(true);
    window.location.replace(buildSignInRedirectUrl(returnPath));
  }, [requireAuth, isAuthenticated, isPending]);

  if (!requireAuth || isAuthenticated) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-canvas-bg/95 px-4 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy={isPending || redirecting}
    >
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-canvas-border border-t-canvas-accent" />
      <p className="mt-4 text-sm font-medium text-slate-300">
        {redirecting ? 'Redirecting to sign in…' : 'Checking your session…'}
      </p>
    </div>
  );
}
