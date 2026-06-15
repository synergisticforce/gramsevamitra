import { useCallback, useEffect, useState } from 'react';
import {
  PWA_INSTALL_READY_EVENT,
  PWA_INSTALLED_EVENT,
  dismissInstallBanner,
  initPwaInstall,
  isNativeInstallAvailable,
  isStandalone,
  triggerPwaInstall,
} from '../lib/pwaInstall';

export default function InstallAppBanner() {
  const [canInstall, setCanInstall] = useState(false);

  const hide = useCallback(() => {
    dismissInstallBanner();
    setCanInstall(false);
  }, []);

  useEffect(() => {
    if (isStandalone()) return;

    initPwaInstall();

    const sync = () => setCanInstall(isNativeInstallAvailable());

    sync();

    const onReady = () => sync();
    const onInstalled = () => setCanInstall(false);

    window.addEventListener(PWA_INSTALL_READY_EVENT, onReady);
    window.addEventListener(PWA_INSTALLED_EVENT, onInstalled);

    return () => {
      window.removeEventListener(PWA_INSTALL_READY_EVENT, onReady);
      window.removeEventListener(PWA_INSTALLED_EVENT, onInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    const outcome = await triggerPwaInstall();
    if (outcome === 'accepted') {
      setCanInstall(false);
      return;
    }
    if (outcome === 'dismissed') {
      hide();
    }
  }, [hide]);

  if (!canInstall) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-canvas-border bg-slate-950 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_30px_rgba(0,0,0,0.45)] md:hidden"
      role="region"
      aria-label="Install GramSeva Mitra app"
    >
      <div className="mx-auto flex max-w-lg items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-canvas-accent-muted text-sm font-bold text-canvas-text">
          GS
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-canvas-text">
            Get the GramSeva App — Works offline. Zero MB storage.
          </p>
        </div>
        <button
          type="button"
          onClick={hide}
          className="shrink-0 rounded-lg p-1.5 text-canvas-subtle transition hover:bg-canvas-elevated hover:text-canvas-text"
          aria-label="Dismiss install banner"
        >
          ✕
        </button>
      </div>
      <div className="mx-auto mt-3 flex max-w-lg gap-2">
        <button
          type="button"
          onClick={handleInstall}
          className="flex-1 rounded-xl bg-[#10b981] px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-950"
        >
          Install App
        </button>
        <button
          type="button"
          onClick={hide}
          className="rounded-xl border border-canvas-border px-4 py-2.5 text-sm font-medium text-canvas-muted transition hover:border-slate-500 hover:text-canvas-text"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
