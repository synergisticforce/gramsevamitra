import { useState } from 'react';
import ContactSupportScreen from './ContactSupportScreen';

type SettingsView = 'menu' | 'contact';

export default function SettingsScreen() {
  const [view, setView] = useState<SettingsView>('menu');

  if (view === 'contact') {
    return <ContactSupportScreen onBack={() => setView('menu')} />;
  }

  return (
    <section className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-6 sm:px-5">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-canvas-subtle">
          Settings
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-canvas-text">App settings</h1>
        <p className="text-sm font-medium leading-relaxed text-slate-300">
          Account help, billing questions, and product feedback — reach the GramSeva Mitra team
          directly.
        </p>
      </header>

      <nav className="space-y-2" aria-label="Settings">
        <button
          type="button"
          onClick={() => setView('contact')}
          className="flex w-full items-center justify-between rounded-2xl border border-canvas-border bg-canvas-surface px-4 py-4 text-left transition hover:bg-canvas-elevated active:scale-[0.99]"
        >
          <span>
            <span className="block text-sm font-bold text-canvas-text">Contact Support</span>
            <span className="mt-0.5 block text-xs font-medium text-slate-300">
              Email contact@gramsevamitra.com from inside the app
            </span>
          </span>
          <span className="text-slate-400" aria-hidden="true">
            →
          </span>
        </button>
      </nav>
    </section>
  );
}
