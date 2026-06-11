import { useCallback, useEffect, useRef, useState } from 'react';
import { SITES, utilitiesHref } from '../config/sites';

type SiteKey = 'hub' | 'utilities' | 'optimizer' | 'resume' | 'pdf';

const NAV_LINKS: { key: SiteKey; label: string; href: string }[] = [
  { key: 'hub', label: 'Home', href: SITES.hub.url },
  { key: 'utilities', label: 'Utilities', href: utilitiesHref('/tools') },
  { key: 'optimizer', label: 'Doc Optimizer', href: SITES.optimizer.url },
  { key: 'resume', label: 'Resume Scanner', href: SITES.resume.url },
  { key: 'pdf', label: 'PDF Tools', href: SITES.pdf.url },
];

interface Props {
  active?: SiteKey;
}

function MenuIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export default function MobileNavMenu({ active = 'hub' }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (containerRef.current && target && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative sm:hidden">
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/40"
          aria-label="Close navigation menu"
          onClick={close}
        />
      )}

      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="mobile-nav-menu"
        aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
        className="relative z-50 inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-emerald-800/60 hover:text-white"
      >
        {open ? (
          <>
            <CloseIcon />
            Close
          </>
        ) : (
          <>
            <MenuIcon />
            Menu
          </>
        )}
      </button>

      {open && (
        <ul
          id="mobile-nav-menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-emerald-900/50 bg-slate-900 py-1 shadow-2xl"
        >
          {NAV_LINKS.map(({ key, label, href }) => (
            <li key={key}>
              <a
                href={href}
                data-astro-reload={active !== key ? true : undefined}
                onClick={close}
                className={`block px-4 py-3.5 text-sm transition hover:bg-slate-800 ${
                  active === key ? 'font-semibold text-emerald-400' : 'text-slate-200'
                }`}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
