const AUTH_RETURN_TO_KEY = 'gsm:auth-return-to';

function isSafeReturnPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('://');
}

/** Persist a post-login destination across the sign-in redirect flow. */
export function stashAuthReturnTo(path: string): void {
  if (typeof window === 'undefined' || !isSafeReturnPath(path)) return;
  sessionStorage.setItem(AUTH_RETURN_TO_KEY, path);
}

/** Read the stored post-login destination without clearing it. */
export function peekAuthReturnTo(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(AUTH_RETURN_TO_KEY);
  if (!raw || !isSafeReturnPath(raw)) return null;
  return raw;
}

/** Read and clear the stored post-login destination, if any. */
export function consumeAuthReturnTo(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(AUTH_RETURN_TO_KEY);
  sessionStorage.removeItem(AUTH_RETURN_TO_KEY);
  if (!raw || !isSafeReturnPath(raw)) return null;
  return raw;
}

/** Build the home-page URL that opens AuthModal after an auth intercept. */
export function buildSignInRedirectUrl(returnPath?: string): string {
  const url = new URL('/', window.location.origin);
  url.searchParams.set('signIn', '1');
  if (returnPath && isSafeReturnPath(returnPath)) {
    url.searchParams.set('returnTo', returnPath);
  }
  return url.toString();
}

/** Strip sign-in query params after AuthModal consumes them. */
export function cleanSignInQueryFromUrl(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('signIn') && !url.searchParams.has('returnTo')) return;
  url.searchParams.delete('signIn');
  url.searchParams.delete('returnTo');
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, '', next || '/');
}

/** Navigate to the stored return path or reload the current page. */
export function finishAuthSuccessNavigation(): void {
  const returnTo = consumeAuthReturnTo();
  if (returnTo) {
    window.location.replace(returnTo);
    return;
  }
  window.location.reload();
}
