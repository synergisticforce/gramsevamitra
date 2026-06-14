import type { ReactNode } from 'react';

interface Props {
  title: string;
  children: ReactNode;
}

const LAST_UPDATED = 'June 2026';

export default function LegalDocumentShell({ title, children }: Props) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-8 border-b border-slate-200 pb-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">Legal</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: {LAST_UPDATED}</p>
      </header>
      <div className="space-y-4 text-sm leading-relaxed text-slate-700">{children}</div>
    </article>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}
