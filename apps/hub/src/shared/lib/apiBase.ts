import { Capacitor } from '@capacitor/core';

/** Production origin for API/auth when the Capacitor WebView serves local assets. */
export const PRODUCTION_ORIGIN = 'https://gramsevamitra.com';

/**
 * Native WebViews load bundled files from a local origin (e.g. https://localhost).
 * API routes live on Cloudflare at the production host — resolve accordingly.
 */
export function getApiOrigin(): string {
  if (typeof window === 'undefined') return PRODUCTION_ORIGIN;
  if (Capacitor.isNativePlatform()) return PRODUCTION_ORIGIN;
  return window.location.origin;
}

/** Path for web (same-origin); absolute production URL on native Capacitor. */
export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined' && !Capacitor.isNativePlatform()) {
    return normalized;
  }
  return `${getApiOrigin()}${normalized}`;
}

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), init);
}
