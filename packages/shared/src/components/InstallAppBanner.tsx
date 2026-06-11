import { useCallback, useEffect, useState } from 'react';
import {
  PWA_INSTALL_READY_EVENT,
  PWA_INSTALLED_EVENT,
  dismissInstallBanner,
  initPwaInstall,
  isIosSafari,
  isNativeInstallAvailable,
  isStandalone,
  triggerPwaInstall,
  type PwaInstallReadyDetail,
} from '../lib/pwaInstall';

export default function InstallAppBanner() {
  const [visible, setVisible] = useState(false);
  const [iosMode, setIosMode] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  const hide = useCallback(() => {
    dismissInstallBanner();
    setVisible(false);
    setIosHint(false);
  }, []);

  useEffect(() => {
    if (isStandalone()) return;

    initPwaInstall();

    const onReady = (event: Event) => {
      const detail = (event as CustomEvent<PwaInstallReadyDetail>).detail;
      const ios = Boolean(detail?.ios) || isIosSafari();
      if (!ios && !isNativeInstallAvailable()) return;
      setIosMode(ios);
      setVisible(true);
    };

    const onInstalled = () => setVisible(false);

    window.addEventListener(PWA_INSTALL_READY_EVENT, onReady);
    window.addEventListener(PWA_INSTALLED_EVENT, onInstalled);

    return () => {
      window.removeEventListener(PWA_INSTALL_READY_EVENT, onReady);
      window.removeEventListener(PWA_INSTALLED_EVENT, onInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    const outcome = await triggerPwaInstall();
    if (outcome === 'ios-hint') {
      setIosHint(true);
      return;
    }
    if (outcome === 'accepted') {
      setVisible(false);
      return;
    }
    if (outcome === 'dismissed') {
      hide();
    }
  }, [hide]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-slate-700 bg-slate-950 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_30px_rgba(0,0,0,0.45)] md:hidden"
      role="region"
      aria-label="Install GramSeva Mitra app"
    >
      <div className="mx-auto flex max-w-lg items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white">
          GS
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-white">
            Get the GramSeva App — Works offline. Zero MB storage.
          </p>
          {iosHint && (
            <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
              On iPhone: tap the <span className="font-semibold text-emerald-400">Share</span> button in
              Safari, then choose <span className="font-semibold text-emerald-400">Add to Home Screen</span>.
            </p>
          )}
          {!iosHint && iosMode && (
            <p className="mt-1 text-xs text-slate-400">
              Tap Install for step-by-step iOS instructions.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={hide}
          className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
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
          className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
