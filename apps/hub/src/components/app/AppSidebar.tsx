import { useCallback, useEffect, useState } from 'react';
import { APP_WORKSPACES, type AppWorkspaceId } from '../../config/appWorkspaces';

interface Props {
  activeWorkspace: AppWorkspaceId;
  currentPath: string;
}

function linkClass(isActive: boolean): string {
  return `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
    isActive
      ? 'bg-slate-200/80 text-slate-800 ring-1 ring-slate-300'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
  }`;
}

export default function AppSidebar({ activeWorkspace, currentPath }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

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
        const isActive =
          workspace.id === activeWorkspace || currentPath.startsWith(workspace.href);
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
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <a href="/workspace/documents" className="text-sm font-bold text-slate-900">
          Gram<span className="text-emerald-600">Seva</span> Mitra
        </a>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
        >
          <span className="sr-only">Menu</span>
          {mobileOpen ? (
            <span aria-hidden="true" className="text-lg">
              ✕
            </span>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={closeMobile}
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-200 px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Workspaces</p>
              <p className="mt-1 text-base font-bold text-slate-900">
                Gram<span className="text-emerald-600">Seva</span> Mitra
              </p>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Workspace navigation">
              {navLinks}
            </nav>
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="border-b border-slate-200 px-5 py-5">
          <a href="/workspace/documents" className="group flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white"
              aria-hidden="true"
            >
              GS
            </span>
            <span className="text-base font-bold tracking-tight text-slate-900">
              Gram<span className="text-emerald-600">Seva</span> Mitra
            </span>
          </a>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Workspace navigation">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Workspaces</p>
          <div className="mt-2">{navLinks}</div>
        </nav>

        <div className="border-t border-slate-200 px-4 py-4 text-xs text-slate-500">
          <a href="/contact" className="font-medium text-slate-700 hover:text-emerald-800">
            Contact &amp; support →
          </a>
        </div>
      </aside>
    </>
  );
}
