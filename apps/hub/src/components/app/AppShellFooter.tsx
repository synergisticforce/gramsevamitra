const LEGAL_LINKS = [
  { href: '/workspace/legal/privacy', label: 'Privacy Policy' },
  { href: '/workspace/legal/terms', label: 'Terms of Service' },
  { href: '/workspace/legal/refund', label: 'Refund Policy' },
] as const;

export const SUPPORT_EMAIL = 'support@gramsevamitra.in';

export default function AppShellFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-canvas-border bg-canvas-surface px-4 py-5 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 text-center sm:flex-row sm:flex-wrap sm:justify-between sm:text-left">
        <nav aria-label="Legal and support">
          <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm sm:justify-start">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="font-medium text-canvas-muted hover:text-canvas-accent">
                  {link.label}
                </a>
              </li>
            ))}
            <li>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="font-medium text-canvas-muted hover:text-canvas-accent"
              >
                Contact Us
              </a>
            </li>
          </ul>
        </nav>
        <p className="text-xs font-medium leading-relaxed text-slate-300">
          © {year} GramSeva Mitra · Pro payments via Razorpay
        </p>
      </div>
    </footer>
  );
}
