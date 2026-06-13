import { createAuthClient } from 'better-auth/react';

function resolveBaseUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return 'https://gramsevamitra.com';
}

export const authClient = createAuthClient({
  baseURL: resolveBaseUrl(),
});

export type { Session } from 'better-auth/types';
