import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { filterTools, type ToolEntry } from '../../config/toolsRegistry';

export const TOOLS_SEARCH_OPEN_EVENT = 'gsm-tools-search-open';

function SearchResultRow({ tool, onNavigate }: { tool: ToolEntry; onNavigate?: () => void }) {
  return (
    <a
      href={tool.path}
      data-tool-id={tool.id}
      onClick={onNavigate}
      className="flex w-full items-center gap-3 rounded-lg border border-emerald-800/30 bg-slate-900/90 px-3 py-2.5 text-left transition hover:border-emerald-500 hover:bg-emerald-950/40 focus:outline-none focus:ring-2 focus:ring-emerald-400"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-white">{tool.name}</span>
        <span className="block truncate text-xs text-slate-400">{tool.description}</span>
      </span>
      <span className="shrink-0 text-xs font-semibold text-emerald-400">Open →</span>
    </a>
  );
}

interface SearchPanelProps {
  searchQuery: string;
  onQueryChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  searchResults: ToolEntry[];
  inputRef?: RefObject<HTMLInputElement>;
  onNavigate?: () => void;
  autoFocus?: boolean;
}

function SearchPanel({
  searchQuery,
  onQueryChange,
  onKeyDown,
  searchResults,
  inputRef,
  onNavigate,
  autoFocus,
}: SearchPanelProps) {
  return (
    <>
      <label className="block">
        <span className="sr-only">Search utilities</span>
        <input
          ref={inputRef}
          type="search"
          value={searchQuery}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search tools… (e.g. EMI, QR code, resume)"
          autoComplete="off"
          autoFocus={autoFocus}
          className="w-full rounded-xl border-2 border-emerald-800/50 bg-slate-900 px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
        />
      </label>

      {searchResults.length > 0 && (
        <div
          className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-emerald-800/40 bg-slate-950/95 p-2 shadow-lg md:max-h-72"
          role="listbox"
          aria-label="Search results"
        >
          {searchResults.map((tool) => (
            <SearchResultRow key={tool.id} tool={tool} onNavigate={onNavigate} />
          ))}
        </div>
      )}

      {searchQuery.trim() && searchResults.length === 0 && (
        <p className="mt-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-center text-xs text-slate-400">
          No tools match &ldquo;{searchQuery.trim()}&rdquo;. Try &ldquo;invoice&rdquo;, &ldquo;gpa&rdquo;, or
          &ldquo;qr&rdquo;.
        </p>
      )}
    </>
  );
}

export default function ToolsSmartSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  const searchResults = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return [];
    return filterTools(query);
  }, [searchQuery]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const openMobile = useCallback(() => {
    setMobileOpen(true);
    requestAnimationFrame(() => mobileInputRef.current?.focus());
  }, []);

  useEffect(() => {
    const onOpen = () => openMobile();
    window.addEventListener(TOOLS_SEARCH_OPEN_EVENT, onOpen);

    const trigger = document.getElementById('tools-search-trigger');
    trigger?.addEventListener('click', onOpen);

    return () => {
      window.removeEventListener(TOOLS_SEARCH_OPEN_EVENT, onOpen);
      trigger?.removeEventListener('click', onOpen);
    };
  }, [openMobile]);

  useEffect(() => {
    if (!mobileOpen) return;

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') closeMobile();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen, closeMobile]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Enter') return;
      const first = searchResults[0];
      if (!first) return;
      event.preventDefault();
      closeMobile();
      window.location.href = first.path;
    },
    [searchResults, closeMobile]
  );

  return (
    <>
      {/* Desktop: sticky top search */}
      <div className="sticky top-[57px] z-30 hidden border-b border-slate-800/60 bg-slate-950/95 px-4 py-3 backdrop-blur-md md:block sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SearchPanel
            searchQuery={searchQuery}
            onQueryChange={setSearchQuery}
            onKeyDown={handleKeyDown}
            searchResults={searchResults}
          />
        </div>
      </div>

      {/* Mobile: full-screen search overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-slate-950 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Search tools"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <h2 className="text-sm font-semibold text-white">Search Tools</h2>
            <button
              type="button"
              onClick={closeMobile}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-400 transition hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
              aria-label="Close search"
            >
              Close
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <SearchPanel
              searchQuery={searchQuery}
              onQueryChange={setSearchQuery}
              onKeyDown={handleKeyDown}
              searchResults={searchResults}
              inputRef={mobileInputRef}
              onNavigate={closeMobile}
              autoFocus
            />
          </div>
        </div>
      )}
    </>
  );
}
