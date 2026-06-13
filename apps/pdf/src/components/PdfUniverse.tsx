import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  INTENT_TABS,
  TOOL_MAP,
  TOOLS_REGISTRY,
  type IntentTabId,
  type ToolEntry,
  type ToolId,
  isToolId,
} from '../config/toolsRegistry';
import { isPdfTabId } from '../config/pdfWorkspaceSegments';
import ToolWorkspaceShell from './workspaces/ToolWorkspaceShell';
import { WorkspaceNavProvider } from './workspaces/WorkspaceNavContext';
import { ToolProgressProvider } from './workspaces/ToolProgressContext';
import { TOOL_COMPONENTS } from './workspaces';

const ALL_TOOLS: ToolEntry[] = TOOLS_REGISTRY;

function parseHash(): ToolId | null {
  const raw = window.location.hash.replace(/^#/, '').trim();
  return raw && isToolId(raw) ? raw : null;
}

function ToolCard({ tool, onOpen }: { tool: ToolEntry; onOpen: (id: ToolId) => void }) {
  const toolId = tool.id;

  return (
    <button
      type="button"
      data-tool-id={toolId}
      onClick={() => onOpen(toolId)}
      className="group flex min-h-[168px] w-full flex-col rounded-2xl border border-emerald-800/40 bg-[#064e3b]/40 p-4 text-left transition hover:border-emerald-500 hover:bg-[#064e3b]/70 focus:outline-none focus:ring-2 focus:ring-emerald-400"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="text-2xl" aria-hidden="true">
          {tool.icon}
        </span>
        <span className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400">
          Free
        </span>
      </div>
      <h3 className="text-base font-bold text-white group-hover:text-emerald-300">{tool.name}</h3>
      <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-300">{tool.description}</p>
      <span className="mt-3 text-xs font-semibold text-emerald-400">Open tool →</span>
    </button>
  );
}

function SearchResultRow({
  tool,
  onOpen,
}: {
  tool: ToolEntry;
  onOpen: (id: ToolId) => void;
}) {
  const toolId = tool.id;

  return (
    <button
      type="button"
      data-tool-id={toolId}
      onClick={() => onOpen(toolId)}
      className="flex w-full items-center gap-3 rounded-lg border border-emerald-800/40 bg-slate-900/80 px-3 py-2.5 text-left transition hover:border-emerald-500 hover:bg-[#064e3b]/50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
    >
      <span className="text-xl" aria-hidden="true">
        {tool.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-white">{tool.name}</span>
        <span className="block truncate text-xs text-slate-400">{tool.description}</span>
      </span>
      <span className="shrink-0 text-xs font-semibold text-emerald-400">Open →</span>
    </button>
  );
}

export default function PdfUniverse() {
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<IntentTabId>('all');
  const [activeToolId, setActiveToolId] = useState<ToolId | null>(null);

  const syncFromHash = useCallback(() => {
    setActiveToolId(parseHash());
  }, []);

  useEffect(() => {
    syncFromHash();
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab && isPdfTabId(tab)) {
      setActiveTab(tab);
    }
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, [syncFromHash]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const openToolById = useCallback((id: ToolId) => {
    window.location.hash = id;
    setActiveToolId(id);
  }, []);

  const backToDashboard = useCallback(() => {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setActiveToolId(null);
    requestAnimationFrame(() => searchRef.current?.focus());
  }, []);

  const tabCategories = useMemo(() => {
    const tab = INTENT_TABS.find((t) => t.id === activeTab);
    return tab?.categories ?? null;
  }, [activeTab]);

  const searchResults = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return query
      ? ALL_TOOLS.filter((tool) => {
          const matchName = tool.name.toLowerCase().includes(query);
          const matchDesc = tool.description.toLowerCase().includes(query);
          const matchAlias = tool.aliases?.some((alias) => alias.toLowerCase().includes(query));
          return matchName || matchDesc || matchAlias;
        })
      : [];
  }, [searchQuery]);

  const gridTools = useMemo(() => {
    if (searchResults.length > 0 || searchQuery.trim()) {
      return searchResults;
    }
    if (tabCategories) {
      return ALL_TOOLS.filter((t) => tabCategories.includes(t.category));
    }
    return ALL_TOOLS;
  }, [searchResults, searchQuery, tabCategories]);

  const handleSearchKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Enter') return;
      const firstMatch = searchResults[0];
      if (!firstMatch) return;
      event.preventDefault();
      openToolById(firstMatch.id);
    },
    [searchResults, openToolById]
  );

  const activeTool = activeToolId ? TOOL_MAP[activeToolId] : null;
  const ActiveWorkspace = activeToolId ? TOOL_COMPONENTS[activeToolId] : null;

  return (
    <div className="relative min-h-[360px]">
      {!activeToolId ? (
        <>
          <div className="sticky top-0 z-30 -mx-4 space-y-3 border-b border-emerald-900/60 bg-slate-950/95 px-4 pb-4 pt-1 backdrop-blur-md sm:-mx-6 sm:px-6">
            <div className="rounded-xl border border-emerald-600/40 bg-[#064e3b]/60 px-3 py-2 text-center text-xs font-medium text-emerald-100 sm:text-sm">
              100% Free Forever — Local Secure Browser Compression (Your data never leaves your device)
            </div>

            <label className="block">
              <span className="sr-only">Search PDF tools</span>
              <input
                ref={searchRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search tools… (e.g. merge, shrink, compress)"
                autoComplete="off"
                className="w-full rounded-xl border-2 border-emerald-600/50 bg-slate-900 px-4 py-3.5 text-base text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
              />
            </label>

            {searchResults.length > 0 && (
              <div
                className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-emerald-800/50 bg-slate-950/90 p-2"
                role="listbox"
                aria-label="Search results"
              >
                {searchResults.map((tool) => (
                  <SearchResultRow key={tool.id} tool={tool} onOpen={openToolById} />
                ))}
              </div>
            )}

            <div
              className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              role="tablist"
              aria-label="Tool categories"
            >
              {INTENT_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition sm:text-sm ${
                    activeTab === tab.id
                      ? 'border-emerald-400 bg-emerald-500 text-[#064e3b]'
                      : 'border-emerald-800/60 bg-[#064e3b]/30 text-emerald-200 hover:border-emerald-500'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            {gridTools.length === 0 ? (
              <p className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-8 text-center text-sm text-slate-400">
                No tools match &ldquo;{searchQuery}&rdquo;. Try terms like &ldquo;merge&rdquo;, &ldquo;shrink&rdquo;, or
                &ldquo;compress&rdquo;.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {gridTools.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} onOpen={openToolById} />
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        activeTool &&
        ActiveWorkspace && (
          <div className="animate-fade-in">
            <WorkspaceNavProvider onBack={backToDashboard}>
              <ToolProgressProvider>
                <ToolWorkspaceShell tool={activeTool} onBack={backToDashboard}>
                  <ActiveWorkspace />
                </ToolWorkspaceShell>
              </ToolProgressProvider>
            </WorkspaceNavProvider>
          </div>
        )
      )}
    </div>
  );
}
