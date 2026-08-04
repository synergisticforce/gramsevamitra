import { Capacitor } from '@capacitor/core';

export interface MLKitStatus {
  isAvailable: boolean;
  isInstalling: boolean;
  error?: string;
}

let latestStatus: MLKitStatus = {
  isAvailable: false,
  isInstalling: false,
};

let preloadPromise: Promise<MLKitStatus> | null = null;

export function getMLKitStatus(): MLKitStatus {
  return { ...latestStatus };
}

/**
 * Silently ensure the Google ML Kit Document Scanner module is available on Android.
 * Safe to call on web/iOS — returns early without throwing.
 */
export async function initMLKitScanner(): Promise<MLKitStatus> {
  if (preloadPromise) {
    return preloadPromise;
  }

  preloadPromise = (async () => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      latestStatus = { isAvailable: false, isInstalling: false };
      return { ...latestStatus };
    }

    latestStatus = { isAvailable: false, isInstalling: true };

    try {
      const { DocumentScanner } = await import('@capacitor-mlkit/document-scanner');
      const availability = await DocumentScanner.isGoogleDocumentScannerModuleAvailable();

      if (availability.available) {
        latestStatus = { isAvailable: true, isInstalling: false };
        return { ...latestStatus };
      }

      await DocumentScanner.installGoogleDocumentScannerModule();
      const afterInstall = await DocumentScanner.isGoogleDocumentScannerModuleAvailable();
      latestStatus = {
        isAvailable: Boolean(afterInstall.available),
        isInstalling: false,
      };
      return { ...latestStatus };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[mlkitPreloader] Silent ML Kit install failed:', message);
      latestStatus = {
        isAvailable: false,
        isInstalling: false,
        error: message,
      };
      return { ...latestStatus };
    }
  })();

  try {
    return await preloadPromise;
  } finally {
    // Allow a later retry after a failed/completed attempt.
    if (!latestStatus.isAvailable) {
      preloadPromise = null;
    }
  }
}
