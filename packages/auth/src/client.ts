import { createAuthClient } from 'better-auth/react';
import { emailOTPClient } from 'better-auth/client/plugins';

const PRODUCTION_ORIGIN = 'https://gramsevamitra.com';

function isNativeCapacitor(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (
    window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }
  ).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

function resolveBaseUrl(): string {
  if (typeof window === 'undefined') return PRODUCTION_ORIGIN;
  // Bundled Capacitor apps run on a local WebView origin — auth API is on production.
  if (isNativeCapacitor()) return PRODUCTION_ORIGIN;
  return window.location.origin;
}

export const authClient = createAuthClient({
  baseURL: resolveBaseUrl(),
  plugins: [emailOTPClient()],
});

export type { Session } from 'better-auth/types';
