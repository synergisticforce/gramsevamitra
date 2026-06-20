import { useCallback, useEffect, useState } from 'react';
import { authClient } from '@gramsevamitra/auth/client';
import { prepareAuthRedirectForProUpgrade } from '../../lib/auth/prepareAuthRedirect';

export const AUTH_MODAL_OPEN_EVENT = 'gsm:auth-modal-open';

type EmailMode = 'magic-link' | 'otp';

type AuthFetchResult = {
  data?: { user?: unknown; token?: string | null } | null;
  error?: { message?: string; code?: string; status?: number; statusText?: string } | null;
};

function resolveOtpErrorMessage(result: AuthFetchResult, fallback: string): string {
  const error = result.error;
  if (!error) return fallback;

  const code = String(error.code ?? error.message ?? '').toUpperCase();

  if (code.includes('INVALID_OTP') || code.includes('INVALID')) {
    return 'Incorrect code. Please try again.';
  }
  if (code.includes('OTP_EXPIRED') || code.includes('EXPIRED')) {
    return 'This code has expired. Please send a new one.';
  }
  if (code.includes('TOO_MANY_ATTEMPTS')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }

  return error.message?.trim() || fallback;
}

function isSuccessfulOtpSignIn(result: AuthFetchResult): boolean {
  if (result.error) return false;
  return Boolean(result.data?.user || result.data?.token);
}

export default function AuthModal() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [emailMode, setEmailMode] = useState<EmailMode>('magic-link');
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => {
    if (busy) return;
    setOpen(false);
    setError(null);
    setMessage(null);
    setOtp('');
    setOtpSent(false);
  }, [busy]);

  useEffect(() => {
    const onOpen = () => {
      setError(null);
      setMessage(null);
      setOpen(true);
    };
    window.addEventListener(AUTH_MODAL_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(AUTH_MODAL_OPEN_EVENT, onOpen);
  }, []);

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
    setBusy(true);
    try {
      await prepareAuthRedirectForProUpgrade();
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: window.location.href,
      });
    } catch (err) {
      if (!handleSesError(err)) {
        setError('Could not start Google sign-in. Please try again.');
      }
      setBusy(false);
    }
  };

  const sendMagicLink = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter your email address.');
      return;
    }
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      await prepareAuthRedirectForProUpgrade();
      await authClient.signIn.magicLink({
        email: trimmed,
        callbackURL: window.location.href,
      });
      setMessage('Check your inbox — we sent a secure sign-in link.');
    } catch (err) {
      if (!handleSesError(err)) {
        setError(err instanceof Error ? err.message : 'Could not send magic link.');
      }
    } finally {
      setBusy(false);
    }
  };

  const sendOtp = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter your email address.');
      return;
    }
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const result = (await authClient.emailOtp.sendVerificationOtp({
        email: trimmed,
        type: 'sign-in',
      })) as AuthFetchResult;

      if (result.error) {
        if (!handleSesError(result.error)) {
          setError(result.error.message ?? 'Could not send verification code.');
        }
        return;
      }

      setOtpSent(true);
      setOtp('');
      setMessage('Enter the 6-digit code we emailed you.');
    } catch (err) {
      if (!handleSesError(err)) {
        setError(err instanceof Error ? err.message : 'Could not send verification code.');
      }
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    const trimmed = email.trim();
    if (!trimmed || !otp.trim()) {
      setError('Enter your email and verification code.');
      return;
    }
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const result = (await authClient.signIn.emailOtp({
        email: trimmed,
        otp: otp.trim(),
      })) as AuthFetchResult;

      if (!isSuccessfulOtpSignIn(result)) {
        setError(resolveOtpErrorMessage(result, 'Incorrect code. Please try again.'));
        setOtp('');
        return;
      }

      await prepareAuthRedirectForProUpgrade();
      setMessage('Signed in successfully.');
      window.setTimeout(() => close(), 800);
    } catch (err) {
      setOtp('');
      if (!handleSesError(err)) {
        setError(err instanceof Error ? err.message : 'Incorrect code. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

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
                Continue with Google or email — no SMS required.
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              disabled={busy}
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
            disabled={busy}
            onClick={() => void signInWithGoogle()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-canvas-border bg-canvas-elevated px-4 py-3 text-sm font-semibold text-canvas-text transition hover:border-emerald-500/50 hover:bg-canvas-surface disabled:opacity-60"
          >
            <span aria-hidden="true">G</span>
            Continue with Google
          </button>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-canvas-border" />
            </div>
            <p className="relative mx-auto w-fit bg-canvas-surface px-2 text-xs font-medium text-slate-300">
              or email
            </p>
          </div>

          <div className="flex gap-2">
            {(['magic-link', 'otp'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                disabled={busy}
                onClick={() => {
                  setEmailMode(mode);
                  setOtpSent(false);
                  setOtp('');
                  setError(null);
                  setMessage(null);
                }}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                  emailMode === mode
                    ? 'border-canvas-accent bg-canvas-accent-soft text-canvas-text'
                    : 'border-canvas-border bg-canvas-elevated text-slate-300 hover:border-canvas-accent'
                }`}
              >
                {mode === 'magic-link' ? 'Magic link' : 'Email code'}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              disabled={busy}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-xl border border-canvas-border bg-canvas-elevated px-3 py-2.5 text-sm text-canvas-text outline-none ring-canvas-accent focus:ring-2"
              placeholder="you@example.com"
            />
          </label>

          {emailMode === 'otp' && otpSent && (
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">Code</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                disabled={busy}
                onChange={(event) => {
                  setOtp(event.target.value);
                  if (error) setError(null);
                }}
                className="mt-1 w-full rounded-xl border border-canvas-border bg-canvas-elevated px-3 py-2.5 text-sm text-canvas-text outline-none ring-canvas-accent focus:ring-2"
                placeholder="6-digit code"
              />
            </label>
          )}

          {message && (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-sm font-medium text-emerald-100">
              {message}
            </p>
          )}

          {error && (
            <p className="rounded-lg border border-canvas-border bg-canvas-danger-soft/30 px-3 py-2 text-sm font-medium text-rose-200" role="alert">
              {error}
            </p>
          )}

          {emailMode === 'magic-link' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void sendMagicLink()}
              className="inline-flex w-full items-center justify-center rounded-xl bg-canvas-accent-muted px-4 py-3 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 disabled:opacity-60"
            >
              {busy ? 'Sending link…' : 'Continue with Email →'}
            </button>
          ) : otpSent ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void verifyOtp()}
              className="inline-flex w-full items-center justify-center rounded-xl bg-canvas-accent-muted px-4 py-3 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 disabled:opacity-60"
            >
              {busy ? 'Verifying…' : 'Verify & sign in'}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void sendOtp()}
              className="inline-flex w-full items-center justify-center rounded-xl bg-canvas-accent-muted px-4 py-3 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 disabled:opacity-60"
            >
              {busy ? 'Sending code…' : 'Send email code'}
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
