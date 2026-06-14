const LEGAL_LINKS = [
  { href: '/workspace/legal/privacy', label: 'Privacy Policy' },
  { href: '/workspace/legal/terms', label: 'Terms of Service' },
  { href: '/workspace/legal/refund', label: 'Refund Policy' },
] as const;

export const SUPPORT_EMAIL = 'support@gramsevamitra.in';

export default function AppShellFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-slate-200 bg-white px-4 py-5 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 text-center sm:flex-row sm:flex-wrap sm:justify-between sm:text-left">
        <nav aria-label="Legal and support">
          <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm sm:justify-start">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="font-medium text-slate-600 hover:text-violet-700">
                  {link.label}
                </a>
              </li>
            ))}
            <li>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="font-medium text-slate-600 hover:text-violet-700"
              >
                Contact Us
              </a>
            </li>
          </ul>
        </nav>
        <p className="text-xs text-slate-500">
          © {year} GramSeva Mitra · Pro payments via Razorpay
        </p>
      </div>
      <p
        className="mx-auto mt-3 max-w-5xl text-center text-sm font-bold uppercase tracking-wide text-red-600"
        data-build-version="DAY-ZERO-V4"
      >
        BUILD_VERSION: DAY-ZERO-V4 [₹99 ACTIVE]
      </p>
    </footer>
  );
}
