import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { filterOmniSearchTools, type OmniSearchTool } from './omniSearch';
import { OMNI_SEARCH_OPEN_EVENT } from './saasNav';

export { OMNI_SEARCH_OPEN_EVENT };

interface Props {
  tools: OmniSearchTool[];
  placeholder?: string;
  hint?: string;
  footerLabel?: string;
  defaultCount?: number;
  maxResults?: number;
}

function ResultRow({ tool, onNavigate }: { tool: OmniSearchTool; onNavigate: () => void }) {
  return (
    <a
      href={tool.href}
      onClick={onNavigate}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-slate-100 focus:bg-slate-100 focus:outline-none"
      role="option"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-900">{tool.name}</span>
        <span className="block truncate text-xs text-slate-500">{tool.description}</span>
      </span>
      <span className="shrink-0 text-xs font-medium text-emerald-700">Open</span>
    </a>
  );
}

export default function OmniSearchPalette({
  tools,
  placeholder = 'Search tools…',
  hint = 'Try EMI calculator, merge PDF, or QR code',
  footerLabel = 'Quick Tools Drawer',
  defaultCount = 8,
  maxResults = 12,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return tools.slice(0, defaultCount);
    return filterOmniSearchTools(tools, q).slice(0, maxResults);
  }, [query, tools, defaultCount, maxResults]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  const openPalette = useCallback(() => {
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((prev) => {
          if (!prev) requestAnimationFrame(() => inputRef.current?.focus());
          return !prev;
        });
      }
    };

    const onOpenEvent = () => openPalette();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener(OMNI_SEARCH_OPEN_EVENT, onOpenEvent);

    const desktopTrigger = document.getElementById('saas-cmdk-trigger');
    const mobileTrigger = document.getElementById('saas-mobile-search-trigger');
    desktopTrigger?.addEventListener('click', onOpenEvent);
    mobileTrigger?.addEventListener('click', onOpenEvent);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(OMNI_SEARCH_OPEN_EVENT, onOpenEvent);
      desktopTrigger?.removeEventListener('click', onOpenEvent);
      mobileTrigger?.removeEventListener('click', onOpenEvent);
    };
  }, [openPalette]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onEscape);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onEscape);
    };
  }, [open, close]);

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') close();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 pt-[12vh] backdrop-blur-sm"
      role="presentation"
      onClick={close}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Quick tools search"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-4 py-3">
          <label className="block">
            <span className="sr-only">Search tools</span>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder={placeholder}
              autoComplete="off"
              className="w-full border-0 bg-transparent text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
            />
          </label>
          <p className="mt-1 text-xs text-slate-500">{hint}</p>
        </div>

        <ul className="max-h-[min(50vh,420px)] overflow-y-auto p-2" role="listbox">
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-slate-500">No tools match your search.</li>
          ) : (
            results.map((tool) => (
              <li key={tool.id}>
                <ResultRow tool={tool} onNavigate={close} />
              </li>
            ))
          )}
        </ul>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
          <span>{footerLabel}</span>
          <span>
            <kbd className="rounded border border-slate-200 bg-white px-1">↵</kbd> open ·{' '}
            <kbd className="rounded border border-slate-200 bg-white px-1">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
