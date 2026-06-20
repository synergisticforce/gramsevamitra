import { SIDEBAR_TOGGLE_EVENT } from '../../lib/app/shellEvents';
import AppSessionHeader from './AppSessionHeader';

export default function AppGlobalHeader() {
  const toggleSidebar = () => {
    window.dispatchEvent(new Event(SIDEBAR_TOGGLE_EVENT));
  };

  return (
    <header className="sticky top-0 z-50 flex h-[3.625rem] w-full shrink-0 items-center justify-between gap-3 border-b border-canvas-border bg-canvas-surface/95 px-4 backdrop-blur-md md:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
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
          className="group flex min-w-0 items-center gap-2 truncate md:gap-2.5"
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-canvas-accent-muted text-xs font-bold text-canvas-text"
            aria-hidden="true"
          >
            GS
          </span>
          <span className="truncate text-sm font-bold tracking-tight text-canvas-text md:text-base">
            Gram<span className="text-canvas-accent">Seva</span> Mitra
          </span>
        </a>
      </div>

      <div className="flex shrink-0 items-center">
        <AppSessionHeader compact variant="global" />
      </div>
    </header>
  );
}
