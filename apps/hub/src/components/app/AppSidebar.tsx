import { useCallback, useEffect, useState } from 'react';
import { SIDEBAR_TOGGLE_EVENT } from '../../lib/app/shellEvents';
import { APP_WORKSPACES, type AppWorkspaceId } from '../../config/appWorkspaces';

interface Props {
  activeWorkspace?: AppWorkspaceId;
  currentPath: string;
}

function linkClass(isActive: boolean): string {
  return `flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
    isActive
      ? 'bg-canvas-elevated text-canvas-text ring-1 ring-canvas-border'
      : 'text-canvas-muted hover:bg-canvas-elevated hover:text-canvas-text'
  }`;
}

export default function AppSidebar({ activeWorkspace, currentPath }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    const onToggle = () => setMobileOpen((open) => !open);
    window.addEventListener(SIDEBAR_TOGGLE_EVENT, onToggle);
    return () => window.removeEventListener(SIDEBAR_TOGGLE_EVENT, onToggle);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    document.body.style.overflow = 'hidden';
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMobile();
    };
    window.addEventListener('keydown', onEscape);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onEscape);
    };
  }, [mobileOpen, closeMobile]);

  const navLinks = (
    <ul className="space-y-1">
      {APP_WORKSPACES.map((workspace) => {
        const current = currentPath.split('?')[0]?.replace(/\/$/, '') ?? '';
        const href = workspace.href.replace(/\/$/, '');
        const isActive =
          workspace.id === activeWorkspace || current === href || current.startsWith(`${href}/`);
        return (
          <li key={workspace.id}>
            <a
              href={workspace.href}
              className={linkClass(isActive)}
              aria-current={isActive ? 'page' : undefined}
              onClick={closeMobile}
            >
              <span className="text-lg" aria-hidden="true">
                {workspace.emoji}
              </span>
              <span>{workspace.label}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-canvas-bg/80 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={closeMobile}
          />
          <aside className="absolute left-0 top-0 flex h-full w-80 max-w-[88vw] flex-col border-r border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-canvas-border px-5 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-canvas-subtle">Workspaces</p>
                <p className="mt-1 text-base font-bold text-canvas-text">
                  Gram<span className="text-canvas-accent">Seva</span> Mitra
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-canvas-border text-canvas-muted"
                aria-label="Close menu"
                onClick={closeMobile}
              >
                ✕
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="All tools">
              <p className="px-3 text-sm font-black text-slate-900">Roles</p>
              <ul className="mt-2 space-y-1">
                <li><a className="flex min-h-[52px] items-center rounded-2xl px-3 font-bold text-slate-900" href="/owner/" onClick={closeMobile}>🍽️ Owner App</a></li>
                <li><a className="flex min-h-[52px] items-center rounded-2xl px-3 font-bold text-slate-900" href="/seller/" onClick={closeMobile}>📦 Seller Hub</a></li>
                <li><a className="flex min-h-[52px] items-center rounded-2xl px-3 font-bold text-slate-900" href="/munshi/" onClick={closeMobile}>💼 Munshi Desk</a></li>
              </ul>
              <p className="mt-4 px-3 text-sm font-black text-slate-900">Studios</p>
              <div className="mt-2">{navLinks}</div>
            </nav>
            <div className="border-t border-canvas-border px-4 py-2">
              <a
                href="/contact"
                className="flex min-h-11 items-center text-sm font-medium leading-relaxed text-slate-300 hover:text-canvas-accent"
              >
                Contact &amp; support →
              </a>
            </div>
          </aside>
        </div>
      )}

      <aside className="hidden" aria-hidden="true">
        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Workspace navigation">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-canvas-subtle">Workspaces</p>
          <div className="mt-2">{navLinks}</div>
        </nav>

        <div className="border-t border-canvas-border px-4 py-2">
          <a
            href="/contact"
            className="flex min-h-11 items-center text-sm font-medium leading-relaxed text-slate-300 hover:text-canvas-accent"
          >
            Contact &amp; support →
          </a>
        </div>
      </aside>
    </>
  );
}
