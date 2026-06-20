import type { ReactNode } from 'react';
import { openAuthModal } from '../../lib/auth/triggers';
import { stashAuthReturnTo } from '../../lib/auth/returnTo';
import { useSafeSession } from '../../lib/auth/useSafeSession';

interface Props {
  requireAuth: boolean;
  children: ReactNode;
}

export default function WorkspaceAuthBoundary({ requireAuth, children }: Props) {
  const { user, isPending } = useSafeSession();

  if (!requireAuth) {
    return <>{children}</>;
  }

  if (isPending) {
    return (
      <div className="flex min-h-[40vh] flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-canvas-border border-t-canvas-accent"
          aria-hidden="true"
        />
        <p className="mt-3 text-sm font-medium text-slate-400">Checking your session…</p>
      </div>
    );
  }

  if (!user) {
    const openSignIn = () => {
      stashAuthReturnTo(`${window.location.pathname}${window.location.search}`);
      openAuthModal();
    };

    return (
      <div className="flex min-h-[40vh] flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-canvas-text">Sign in to use this workspace</h2>
        <p className="mt-2 max-w-md text-sm font-medium leading-relaxed text-slate-300">
          A free account unlocks sync, credits, and Pro tools here. Other offline workspaces stay
          available without signing in.
        </p>
        <button
          type="button"
          onClick={openSignIn}
          className="mt-6 inline-flex h-10 items-center justify-center rounded-lg border border-canvas-border bg-canvas-elevated px-5 text-sm font-semibold text-canvas-text transition hover:border-emerald-500/50 hover:bg-canvas-surface"
        >
          Sign In
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
