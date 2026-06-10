export const PWA_INSTALL_READY_EVENT = 'pwa-install-ready';
export const PWA_INSTALLED_EVENT = 'pwa-installed';
export const PWA_INSTALL_DISMISSED_KEY = 'gsm-pwa-install-dismissed';

export type PwaInstallReadyDetail = {
  ios?: boolean;
};

export type PwaInstallOutcome = 'accepted' | 'dismissed' | 'unavailable' | 'ios-hint';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let initialized = false;

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    nav.standalone === true
  );
}

export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIOS && isSafari;
}

export function wasInstallBannerDismissed(): boolean {
  try {
    return localStorage.getItem(PWA_INSTALL_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissInstallBanner(): void {
  try {
    localStorage.setItem(PWA_INSTALL_DISMISSED_KEY, '1');
  } catch {
    /* storage blocked */
  }
}

export function isNativeInstallAvailable(): boolean {
  return deferredPrompt !== null;
}

export function initPwaInstall(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  if (isStandalone() || wasInstallBannerDismissed()) return;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    window.dispatchEvent(
      new CustomEvent<PwaInstallReadyDetail>(PWA_INSTALL_READY_EVENT, {
        detail: { ios: false },
      })
    );
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    dismissInstallBanner();
    window.dispatchEvent(new CustomEvent(PWA_INSTALLED_EVENT));
  });

  if (isIosSafari()) {
    window.dispatchEvent(
      new CustomEvent<PwaInstallReadyDetail>(PWA_INSTALL_READY_EVENT, {
        detail: { ios: true },
      })
    );
  }
}

export async function triggerPwaInstall(): Promise<PwaInstallOutcome> {
  if (isIosSafari()) {
    dismissInstallBanner();
    return 'ios-hint';
  }

  if (!deferredPrompt) {
    return 'unavailable';
  }

  try {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;

    console.info(`[PWA] Install prompt outcome: ${outcome}`);

    if (outcome === 'accepted') {
      dismissInstallBanner();
    }

    return outcome;
  } catch (err) {
    console.warn('[PWA] Install prompt failed:', err);
    deferredPrompt = null;
    return 'unavailable';
  }
}
