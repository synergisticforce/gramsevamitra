import { useCallback, useEffect, useState } from 'react';
import { authClient } from '@gramsevamitra/auth/client';
import { prepareAuthRedirectForProUpgrade } from '../../lib/auth/prepareAuthRedirect';
import { isStorageAccessError } from '../../lib/storage/safeStorage';
import {
  cleanSignInQueryFromUrl,
  finishAuthSuccessNavigation,
  peekAuthReturnTo,
  stashAuthReturnTo,
} from '../../lib/auth/returnTo';

export const AUTH_MODAL_OPEN_EVENT = 'gsm:auth-modal-open';

/** Slightly longer than Better Auth's 60s OTP endpoint rate-limit window. */
const OTP_RATE_LIMIT_MS = 61_000;

type OtpErrorKind =
  | 'invalid'
  | 'expired'
  | 'rate_limited'
  | 'too_many_attempts'
  | 'needs_fresh_code'
  | 'generic';

type AuthFetchResult = {
  data?: { user?: unknown; token?: string | null; success?: boolean } | null;
  error?: { message?: string; code?: string; status?: number; statusText?: string } | null;
};

function parseAuthError(result: AuthFetchResult, fallback: string): string {
  const error = result.error;
  if (!error) return fallback;

  const message = error.message?.trim();
  if (message) return message;

  const code = String(error.code ?? '').trim();
  if (code) return code;

  if (error.status === 500) {
    return 'Authentication service is temporarily unavailable. Please try again in a moment.';
  }
  if (error.status === 429) {
    return 'Too many attempts. Please wait about a minute and try again.';
  }

  return fallback;
}

function classifyOtpError(result: AuthFetchResult, needsFreshCode: boolean): {
  kind: OtpErrorKind;
  message: string;
  requiresFreshCode: boolean;
} {
  const error = result.error;
  if (!error) {
    return {
      kind: 'generic',
      message: parseAuthError(result, 'Sign-in failed. Please try again.'),
      requiresFreshCode: false,
    };
  }

  const status = error.status ?? 0;
  const code = String(error.code ?? error.message ?? '').toUpperCase();

  if (status === 429 || code.includes('RATE') || code.includes('TOO_MANY_REQUESTS')) {
    return {
      kind: 'rate_limited',
      message: 'Too many attempts. Wait about a minute, then tap Try again.',
      requiresFreshCode: true,
    };
  }

  if (code.includes('TOO_MANY_ATTEMPTS')) {
    return {
      kind: 'too_many_attempts',
      message: 'Too many wrong tries. Tap Resend code to get a fresh code.',
      requiresFreshCode: true,
    };
  }

  if (code.includes('OTP_EXPIRED') || code.includes('EXPIRED')) {
    return {
      kind: 'expired',
      message: 'This code has expired. Tap Resend code for a new one.',
      requiresFreshCode: true,
    };
  }

  if (code.includes('INVALID_OTP') || code.includes('INVALID')) {
    if (needsFreshCode) {
      return {
        kind: 'needs_fresh_code',
        message: 'Your previous code is no longer valid. Tap Resend code for a new one.',
        requiresFreshCode: true,
      };
    }
    return {
      kind: 'invalid',
      message: 'Incorrect code. Please try again.',
      requiresFreshCode: false,
    };
  }

  return {
    kind: 'generic',
    message: parseAuthError(result, 'Sign-in failed. Please try again.'),
    requiresFreshCode: false,
  };
}

function isSuccessfulOtpSignIn(result: AuthFetchResult): boolean {
  if (result.error) return false;
  return Boolean(result.data?.user || result.data?.token);
}

function isSuccessfulOtpSend(result: AuthFetchResult): boolean {
  if (result.error) return false;
  return result.data?.success === true;
}

export default function AuthModal() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isOtpLoading, setIsOtpLoading] = useState(false);
  const [isOtpVerifyLoading, setIsOtpVerifyLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsFreshCode, setNeedsFreshCode] = useState(false);
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null);
  const [rateLimitSecondsLeft, setRateLimitSecondsLeft] = useState(0);
  const [rateLimitReady, setRateLimitReady] = useState(false);

  const anyLoading = isGoogleLoading || isOtpLoading || isOtpVerifyLoading;

  const resetForm = useCallback(() => {
    setEmail('');
    setOtp('');
    setOtpSent(false);
    setKeepSignedIn(true);
    setNeedsFreshCode(false);
    setRateLimitedUntil(null);
    setRateLimitSecondsLeft(0);
    setRateLimitReady(false);
    setError(null);
    setMessage(null);
    setIsGoogleLoading(false);
    setIsOtpLoading(false);
    setIsOtpVerifyLoading(false);
  }, []);

  const clearRateLimitLockout = useCallback(() => {
    setRateLimitedUntil(null);
    setRateLimitSecondsLeft(0);
    setRateLimitReady(false);
    setNeedsFreshCode(false);
    setError(null);
    setMessage('You can request a new code now.');
  }, []);

  const close = useCallback(() => {
    if (anyLoading) return;
    setOpen(false);
    resetForm();
  }, [anyLoading, resetForm]);

  useEffect(() => {
    const onOpen = () => {
      resetForm();
      setOpen(true);
    };
    window.addEventListener(AUTH_MODAL_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(AUTH_MODAL_OPEN_EVENT, onOpen);
  }, [resetForm]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('signIn') !== '1') return;

    const returnTo = params.get('returnTo');
    if (returnTo) stashAuthReturnTo(returnTo);

    resetForm();
    setOpen(true);
    cleanSignInQueryFromUrl();
  }, [resetForm]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onEscape);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onEscape);
    };
  }, [close, open]);

  useEffect(() => {
    if (!rateLimitedUntil) {
      setRateLimitSecondsLeft(0);
      setRateLimitReady(false);
      return;
    }

    const tick = () => {
      const remainingMs = rateLimitedUntil - Date.now();
      if (remainingMs <= 0) {
        setRateLimitedUntil(null);
        setRateLimitSecondsLeft(0);
        setRateLimitReady(true);
        setError(null);
        setMessage('Wait finished — tap Try again to request a new code.');
        return;
      }
      setRateLimitSecondsLeft(Math.ceil(remainingMs / 1000));
    };

    tick();
    const interval = window.setInterval(tick, 500);
    return () => window.clearInterval(interval);
  }, [rateLimitedUntil]);

  const handleSesError = (err: unknown): boolean => {
    const text = err instanceof Error ? err.message : String(err);
    if (text.includes('SES_SANDBOX_ERROR')) {
      setError(
        'Email could not be sent (SES sandbox). Verify this address in Amazon SES or use Google sign-in.',
      );
      return true;
    }
    return false;
  };

  const signInWithGoogle = async () => {
    setError(null);
    setMessage(null);
    setIsGoogleLoading(true);

    const startGoogleOAuth = async () => {
      const returnPath = peekAuthReturnTo();
      const callbackURL = returnPath
        ? `${window.location.origin}${returnPath}`
        : window.location.href;
      await authClient.signIn.social({
        provider: 'google',
        callbackURL,
        rememberMe: keepSignedIn,
      });
    };

    try {
      await prepareAuthRedirectForProUpgrade();
      await startGoogleOAuth();
    } catch (err) {
      if (isStorageAccessError(err)) {
        console.warn('[auth] Google sign-in retrying without local resume cache', err);
        try {
          await startGoogleOAuth();
          return;
        } catch (retryErr) {
          if (!handleSesError(retryErr)) {
            setError(
              'Could not start Google sign-in. If you are in Private Browsing, try the email code option.',
            );
          }
          return;
        }
      }
      if (!handleSesError(err)) {
        setError('Could not start Google sign-in. Please try again.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const sendOtp = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError('Enter your email address.');
      return;
    }

    if (rateLimitedUntil && Date.now() < rateLimitedUntil) {
      setError(`Please wait ${rateLimitSecondsLeft}s before requesting another code.`);
      return;
    }

    setError(null);
    setMessage(null);
    setRateLimitReady(false);
    setIsOtpLoading(true);
    try {
      const result = (await authClient.emailOtp.sendVerificationOtp({
        email: trimmed,
        type: 'sign-in',
      })) as AuthFetchResult;

      if (!isSuccessfulOtpSend(result)) {
        const classified = classifyOtpError(result, false);
        if (classified.kind === 'rate_limited') {
          setRateLimitedUntil(Date.now() + OTP_RATE_LIMIT_MS);
          setNeedsFreshCode(true);
        }
        if (!handleSesError(result.error)) {
          setError(classified.message);
        }
        return;
      }

      setNeedsFreshCode(false);
      setRateLimitedUntil(null);
      setRateLimitReady(false);
      setOtpSent(true);
      setOtp('');
      setMessage('Enter the 6-digit code we emailed you.');
    } catch (err) {
      if (!handleSesError(err)) {
        setError(err instanceof Error ? err.message : 'Could not send verification code.');
      }
    } finally {
      setIsOtpLoading(false);
    }
  };

  const verifyOtp = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !otp.trim()) {
      setError('Enter your email and verification code.');
      return;
    }

    if (needsFreshCode) {
      setError('Tap Resend code to get a fresh code before verifying.');
      setOtp('');
      return;
    }

    setError(null);
    setMessage(null);
    setIsOtpVerifyLoading(true);
    try {
      const result = (await authClient.signIn.emailOtp({
        email: trimmed,
        otp: otp.trim(),
        rememberMe: keepSignedIn,
      })) as AuthFetchResult;

      if (!isSuccessfulOtpSignIn(result)) {
        const classified = classifyOtpError(result, needsFreshCode);
        if (classified.requiresFreshCode) {
          setNeedsFreshCode(true);
        }
        if (classified.kind === 'rate_limited') {
          setRateLimitedUntil(Date.now() + OTP_RATE_LIMIT_MS);
        }
        setError(classified.message);
        setOtp('');
        return;
      }

      await prepareAuthRedirectForProUpgrade();
      setNeedsFreshCode(false);
      setRateLimitedUntil(null);
      setRateLimitReady(false);
      setMessage('Signed in successfully.');
      window.setTimeout(() => finishAuthSuccessNavigation(), 400);
    } catch (err) {
      setOtp('');
      if (!handleSesError(err)) {
        setError(err instanceof Error ? err.message : 'Incorrect code. Please try again.');
      }
    } finally {
      setIsOtpVerifyLoading(false);
    }
  };

  const resendBlocked = Boolean(rateLimitedUntil && Date.now() < rateLimitedUntil);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-4 backdrop-blur-sm sm:items-center"
      role="presentation"
      onClick={close}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-canvas-border bg-canvas-surface shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-canvas-border bg-canvas-elevated px-5 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="auth-modal-title" className="text-xl font-bold text-canvas-text">
                Sign in to GramSeva Mitra
              </h2>
              <p className="mt-1 text-sm font-medium leading-relaxed text-slate-200">
                Continue with Google or a one-time email code.
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              disabled={anyLoading}
              className="rounded-lg border border-canvas-border px-2 py-1 text-sm font-medium text-slate-200 transition hover:bg-canvas-elevated disabled:opacity-50"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          <button
            type="button"
            disabled={anyLoading}
            onClick={() => void signInWithGoogle()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-canvas-border bg-canvas-elevated px-4 py-3 text-sm font-semibold text-canvas-text transition hover:border-emerald-500/50 hover:bg-canvas-surface disabled:opacity-60"
          >
            <span aria-hidden="true">G</span>
            {isGoogleLoading ? 'Redirecting to Google…' : 'Continue with Google'}
          </button>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-canvas-border" />
            </div>
            <p className="relative mx-auto w-fit bg-canvas-surface px-2 text-xs font-medium text-slate-300">
              or
            </p>
          </div>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              disabled={anyLoading}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-xl border border-canvas-border bg-canvas-elevated px-3 py-2.5 text-sm text-canvas-text outline-none ring-canvas-accent focus:ring-2"
              placeholder="you@example.com"
            />
          </label>

          {otpSent && (
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">Code</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                disabled={anyLoading}
                onChange={(event) => {
                  setOtp(event.target.value);
                  if (error) setError(null);
                }}
                className="mt-1 w-full rounded-xl border border-canvas-border bg-canvas-elevated px-3 py-2.5 text-sm text-canvas-text outline-none ring-canvas-accent focus:ring-2"
                placeholder="6-digit code"
              />
            </label>
          )}

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-canvas-border bg-canvas-elevated px-3 py-3">
            <input
              type="checkbox"
              checked={keepSignedIn}
              disabled={anyLoading}
              onChange={(event) => setKeepSignedIn(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-canvas-border accent-emerald-500"
            />
            <span className="text-sm font-medium leading-relaxed text-slate-200">
              Keep me signed in on this device
              <span className="mt-0.5 block text-xs font-normal text-slate-300">
                {keepSignedIn
                  ? 'Rolling 6-month session while you stay active.'
                  : 'Sign out when you close this browser.'}
              </span>
            </span>
          </label>

          {message && (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-sm font-medium text-emerald-100">
              {message}
            </p>
          )}

          {error && (
            <p
              className="rounded-lg border border-canvas-border bg-canvas-danger-soft/30 px-3 py-2 text-sm font-medium text-rose-200"
              role="alert"
            >
              {error}
            </p>
          )}

          {rateLimitReady && (
            <button
              type="button"
              disabled={anyLoading}
              onClick={() => {
                clearRateLimitLockout();
                void sendOtp();
              }}
              className="inline-flex w-full items-center justify-center rounded-xl border border-canvas-accent bg-canvas-accent-soft px-4 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/30 disabled:opacity-60"
            >
              Try again
            </button>
          )}

          {otpSent && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={anyLoading || resendBlocked}
                onClick={() => void sendOtp()}
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-canvas-border bg-canvas-elevated px-3 py-2.5 text-xs font-semibold text-canvas-text transition hover:border-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
              >
                {isOtpLoading
                  ? 'Sending code…'
                  : resendBlocked
                    ? `Resend code (${rateLimitSecondsLeft}s)`
                    : needsFreshCode
                      ? 'Resend new code'
                      : 'Resend code'}
              </button>
              <button
                type="button"
                disabled={anyLoading}
                onClick={() => {
                  setOtpSent(false);
                  setOtp('');
                  setNeedsFreshCode(false);
                  setError(null);
                  setMessage(null);
                }}
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-canvas-border bg-canvas-surface px-3 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-canvas-accent hover:text-canvas-text disabled:opacity-50 sm:text-sm"
              >
                Use different email
              </button>
            </div>
          )}

          {otpSent ? (
            <button
              type="button"
              disabled={anyLoading || needsFreshCode || resendBlocked}
              onClick={() => void verifyOtp()}
              className="inline-flex w-full items-center justify-center rounded-xl bg-canvas-accent-muted px-4 py-3 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isOtpVerifyLoading
                ? 'Verifying…'
                : needsFreshCode
                  ? 'Resend a new code first'
                  : 'Verify & sign in'}
            </button>
          ) : (
            <button
              type="button"
              disabled={anyLoading || resendBlocked}
              onClick={() => void sendOtp()}
              className="inline-flex w-full items-center justify-center rounded-xl bg-canvas-accent-muted px-4 py-3 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isOtpLoading
                ? 'Sending code…'
                : resendBlocked
                  ? `Wait ${rateLimitSecondsLeft}s…`
                  : 'Send email code'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function openAuthModal(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(AUTH_MODAL_OPEN_EVENT));
}
