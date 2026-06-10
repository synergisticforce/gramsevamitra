import { useEffect } from 'react';
import { Workbox } from 'workbox-window';
import { initPwaInstall } from '@shared/lib/pwaInstall';

export default function PwaRegister() {
  useEffect(() => {
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
