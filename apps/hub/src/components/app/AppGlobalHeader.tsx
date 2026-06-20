import { SIDEBAR_TOGGLE_EVENT } from '../../lib/app/shellEvents';
import AppSessionHeader from './AppSessionHeader';

export default function AppGlobalHeader() {
  const toggleSidebar = () => {
    window.dispatchEvent(new Event(SIDEBAR_TOGGLE_EVENT));
  };

  return (
    <header className="sticky top-0 z-50 flex w-full shrink-0 items-center justify-between gap-3 border-b border-canvas-border bg-canvas-surface px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-canvas-border text-canvas-muted lg:hidden"
          aria-label="Open menu"
          onClick={toggleSidebar}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <a
          href="/workspace/documents"
          className="truncate text-sm font-bold text-canvas-text lg:hidden"
        >
          Gram<span className="text-canvas-accent">Seva</span> Mitra
        </a>
      </div>

      <div className="shrink-0">
        <AppSessionHeader compact variant="global" />
      </div>
    </header>
  );
}
