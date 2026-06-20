import { useCallback, useEffect, useRef, useState } from 'react';
import { openAuthModal } from '../../lib/auth/triggers';
import { performSignOut } from '../../lib/auth/signOutSession';
import { useSafeSession } from '../../lib/auth/useSafeSession';

interface Props {
  compact?: boolean;
  variant?: 'sidebar' | 'global';
}

export default function AppSessionHeader({ compact = false, variant = 'sidebar' }: Props) {
  const { user, isPending } = useSafeSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const signOut = async () => {
    setMenuOpen(false);
    await performSignOut();
  };

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) closeMenu();
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onEscape);
    };
  }, [closeMenu, menuOpen]);

  const typedUser = user as { name?: string; email?: string; plan?: string } | undefined;

  if (isPending) {
    return (
      <div
        className={`animate-pulse rounded-lg bg-canvas-elevated ${compact ? 'h-10 w-24' : 'h-10 w-full'}`}
        aria-hidden="true"
      />
    );
  }

  if (!typedUser) {
    return (
      <button
        type="button"
        onClick={() => openAuthModal()}
        className={`inline-flex h-10 items-center justify-center rounded-lg border border-canvas-border bg-canvas-elevated px-3 text-sm font-semibold text-canvas-text transition hover:border-emerald-500/50 hover:bg-canvas-surface ${
          compact ? '' : 'w-full'
        }`}
      >
        Sign In
      </button>
    );
  }

  const isPro = typedUser.plan === 'pro';
  const label = typedUser.name?.trim() || typedUser.email?.split('@')[0] || 'Account';
  const initial = label.charAt(0).toUpperCase();

  if (variant === 'global') {
    return (
      <div className="flex items-center gap-2 md:gap-2.5">
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex h-10 max-w-[min(100vw-10rem,12rem)] items-center gap-2 rounded-lg border border-canvas-border bg-canvas-elevated px-2.5 text-left transition hover:border-emerald-500/40"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-canvas-accent-muted text-xs font-bold text-canvas-text"
              aria-hidden="true"
            >
              {initial}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-canvas-text">{label}</span>
            {isPro ? (
              <span className="hidden shrink-0 rounded-full border border-emerald-500/40 bg-emerald-950/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-100 sm:inline">
                Pro
              </span>
            ) : null}
            <svg
              viewBox="0 0 20 20"
              className={`h-4 w-4 shrink-0 text-slate-300 transition ${menuOpen ? 'rotate-180' : ''}`}
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-canvas-border bg-canvas-surface py-1 shadow-xl"
            >
              <div className="border-b border-canvas-border px-3 py-2.5">
                <p className="truncate text-sm font-semibold text-canvas-text">{label}</p>
                {typedUser.email && (
                  <p className="truncate text-xs font-medium text-slate-300">{typedUser.email}</p>
                )}
              </div>
              <div className="px-3 py-2">
                {isPro ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-gradient-to-r from-emerald-950/80 to-amber-950/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-100">
                    <span aria-hidden="true">✦</span> GramSeva Pro
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-canvas-border bg-canvas-elevated px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-300">
                    Free Account
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => void signOut()}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-rose-500/50 bg-rose-950/50 px-3 text-xs font-bold uppercase tracking-wide text-rose-100 transition hover:border-rose-400 hover:bg-rose-900/70"
          aria-label="Sign out of GramSeva Mitra"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className={`flex ${compact ? 'flex-row items-center gap-2' : 'flex-col gap-2'}`}>
      <div className={`min-w-0 ${compact ? 'text-right' : ''}`}>
        <p className="truncate text-sm font-semibold text-canvas-text">{label}</p>
        {!compact && typedUser.email && (
          <p className="truncate text-xs font-medium text-slate-300">{typedUser.email}</p>
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
