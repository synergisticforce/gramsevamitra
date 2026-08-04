import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Workbox } from 'workbox-window';
import { initPwaInstall } from '@shared/lib/pwaInstall';

/**
 * Register the web PWA service worker on browsers only.
 * Capacitor ships all assets in the native bundle — a SW on Android/iOS
 * commonly causes blank screens and broken asset fetches.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      if ('serviceWorker' in navigator) {
        void navigator.serviceWorker
          .getRegistrations()
          .then((regs) => Promise.all(regs.map((reg) => reg.unregister())))
          .catch(() => undefined);
      }
      if ('caches' in window) {
        void caches
          .keys()
          .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
          .catch(() => undefined);
      }
      return;
    }

    if (!('serviceWorker' in navigator)) return;

    initPwaInstall();

    const wb = new Workbox('/sw.js', { scope: '/' });

    wb.addEventListener('waiting', () => {
      wb.addEventListener('controlling', () => window.location.reload());
      void wb.messageSkipWaiting();
    });

    void wb.register().catch((err) => {
      console.warn('[PWA] Service worker registration failed:', err);
    });
  }, []);

  return null;
}
