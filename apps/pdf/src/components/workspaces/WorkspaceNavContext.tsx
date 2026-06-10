import { createContext, useContext, type ReactNode } from 'react';

const WorkspaceNavContext = createContext<(() => void) | null>(null);

export function WorkspaceNavProvider({
  onBack,
  children,
}: {
  onBack: () => void;
  children: ReactNode;
}) {
  return <WorkspaceNavContext.Provider value={onBack}>{children}</WorkspaceNavContext.Provider>;
}

export function useBackToTools(): () => void {
  const onBack = useContext(WorkspaceNavContext);
  if (!onBack) {
    return () => {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    };
  }
  return onBack;
}

export function BackToToolsBar() {
  const onBack = useBackToTools();

  return (
    <div className="sticky top-[4.25rem] z-50 -mx-4 -mt-2 mb-4 border-b border-emerald-600/50 bg-[#064e3b]/95 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to All Tools"
        className="inline-flex w-full items-center gap-2 text-sm font-semibold text-emerald-300 transition hover:text-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-[#064e3b]"
      >
        <span aria-hidden="true" className="text-emerald-400">
          ←
        </span>
        Back to All Tools
      </button>
    </div>
  );
}
