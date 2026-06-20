import { createAuthClient } from 'better-auth/react';
import { emailOTPClient } from 'better-auth/client/plugins';

function resolveBaseUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return 'https://gramsevamitra.com';
}

export const authClient = createAuthClient({
  baseURL: resolveBaseUrl(),
  plugins: [emailOTPClient()],
});

export type { Session } from 'better-auth/types';
