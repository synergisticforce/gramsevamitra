import { authClient } from '@gramsevamitra/auth/client';
import { openAuthModal } from '../billing/AuthModal';

interface Props {
  compact?: boolean;
}

export default function AppSessionHeader({ compact = false }: Props) {
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user as { name?: string; email?: string; plan?: string } | undefined;

  const signOut = async () => {
    await authClient.signOut();
    window.location.reload();
  };

  if (isPending) {
    return (
      <div
        className={`animate-pulse rounded-lg bg-canvas-elevated ${compact ? 'h-9 w-24' : 'h-10 w-full'}`}
        aria-hidden="true"
      />
    );
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => openAuthModal()}
        className={`inline-flex items-center justify-center rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2 text-sm font-semibold text-canvas-text transition hover:border-emerald-500/50 hover:bg-canvas-surface ${
          compact ? '' : 'w-full'
        }`}
      >
        Sign In
      </button>
    );
  }

  const isPro = user.plan === 'pro';
  const label = user.name?.trim() || user.email?.split('@')[0] || 'Account';

  return (
    <div className={`flex ${compact ? 'flex-row items-center gap-2' : 'flex-col gap-2'}`}>
      <div className={`min-w-0 ${compact ? 'text-right' : ''}`}>
        <p className="truncate text-sm font-semibold text-canvas-text">{label}</p>
        {!compact && user.email && (
          <p className="truncate text-xs font-medium text-slate-300">{user.email}</p>
        )}
      </div>

      {isPro ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/40 bg-gradient-to-r from-emerald-950/80 to-amber-950/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-100">
          <span aria-hidden="true">✦</span> GramSeva Pro
        </span>
      ) : (
        <span className="inline-flex shrink-0 items-center rounded-full border border-canvas-border bg-canvas-elevated px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-300">
          Free Account
        </span>
      )}

      <button
        type="button"
        onClick={() => void signOut()}
        className={`text-xs font-semibold text-slate-300 underline-offset-2 hover:text-canvas-accent hover:underline ${
          compact ? '' : 'self-start'
        }`}
      >
        Sign out
      </button>
    </div>
  );
}
