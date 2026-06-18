import { useCallback, useEffect, useState } from 'react';
import { authClient } from '@gramsevamitra/auth/client';
import {
  PRO_PRICE_INTERVAL,
  PRO_PRICE_LABEL,
  PRO_UPGRADE_OPEN_EVENT,
  type ProUpgradeDetail,
} from '@shared/lib/proUpgrade';
import {
  useRazorpay,
  verifyRazorpayPaymentOnServer,
  type RazorpaySuccessResponse,
} from '../../lib/billing/useRazorpay';

const DEFAULT_DETAIL: ProUpgradeDetail = {
  featureName: 'GramSeva Mitra Pro',
  featureDescription:
    'Process complex documents with advanced AI, export to Excel, and preserve perfect formatting.',
};

const PRO_FEATURES = [
  'Paddle & GLM AI Layout Reconstruction',
  'Export to Excel (.xlsx), CSV, and XML',
  'Unlimited Complex Document Conversions',
  'Priority Email Support',
] as const;

export default function ProPricingModal() {
  const { data: session, isPending } = authClient.useSession();
  const { preload, startCheckout, loading, error, setError } = useRazorpay();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<ProUpgradeDetail>(DEFAULT_DETAIL);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const close = useCallback(() => {
    if (loading || authLoading) return;
    setOpen(false);
    setError(null);
    setSuccessToast(null);
  }, [authLoading, loading, setError]);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const custom = event as CustomEvent<ProUpgradeDetail>;
      setDetail({ ...DEFAULT_DETAIL, ...custom.detail });
      setError(null);
      setSuccessToast(null);
      setOpen(true);
    };

    window.addEventListener(PRO_UPGRADE_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(PRO_UPGRADE_OPEN_EVENT, onOpen);
  }, [setError]);

  useEffect(() => {
    if (!open) return;
    preload();
    document.body.style.overflow = 'hidden';
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onEscape);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onEscape);
    };
  }, [close, open, preload]);

  const signInWithGoogle = async () => {
    setError(null);
    setAuthLoading(true);
    try {
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: window.location.href,
      });
    } catch {
      setError('Could not start Google sign-in. Please try again.');
      setAuthLoading(false);
    }
  };

  const handlePaymentSuccess = useCallback(
    async (payment: RazorpaySuccessResponse) => {
      await verifyRazorpayPaymentOnServer(payment);
      setSuccessToast('Welcome to Pro! Premium AI engines are now unlocked.');
      window.setTimeout(() => {
        setOpen(false);
        setSuccessToast(null);
        window.location.reload();
      }, 2200);
    },
    [],
  );

  const handleUpgrade = async () => {
    const user = session?.user as { email?: string; name?: string; plan?: string } | undefined;
    if (!user) {
      await signInWithGoogle();
      return;
    }

    try {
      await startCheckout({
        feature: detail.featureId ?? detail.featureName,
        description: `${detail.featureName} — Pro Annual Pass`,
        userName: user.name,
        userEmail: user.email,
        onSuccess: handlePaymentSuccess,
      });
    } catch {
      /* errors surfaced via hook */
    }
  };

  if (!open) return null;

  const user = session?.user as { email?: string; name?: string; plan?: string } | undefined;
  const isPro = user?.plan === 'pro';
  const signedIn = Boolean(user);
  const busy = loading || authLoading || isPending;

  return (
    <>
      <div
        className="fixed inset-0 z-[60] flex items-end justify-center bg-canvas-accent-muted/50 p-4 backdrop-blur-sm sm:items-center"
        role="presentation"
        onClick={close}
      >
        <div
          className="w-full max-w-md overflow-hidden rounded-2xl border border-canvas-border bg-canvas-surface shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pro-pricing-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b border-canvas-border bg-canvas-elevated px-5 py-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="inline-flex items-center gap-1 rounded-full bg-canvas-accent-muted px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-canvas-text">
                  <span aria-hidden="true">⚡</span> Pro
                </p>
                <h2 id="pro-pricing-title" className="mt-2 text-xl font-bold text-canvas-text">
                  Unlock GramSeva Mitra Pro
                </h2>
                <p className="mt-1 text-sm font-medium leading-relaxed text-slate-200">
                  {detail.featureDescription ?? DEFAULT_DETAIL.featureDescription}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="rounded-lg border border-canvas-border px-2 py-1 text-sm font-medium leading-relaxed text-slate-200 transition hover:bg-canvas-elevated disabled:opacity-50"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="space-y-4 px-5 py-5">
            <div className="rounded-xl border border-canvas-border bg-canvas-elevated px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Annual Pass</p>
              <p className="mt-1 text-3xl font-extrabold tabular-nums text-canvas-text">
                {PRO_PRICE_LABEL}
                <span className="text-base font-semibold text-slate-300">{PRO_PRICE_INTERVAL}</span>
              </p>
              <ul className="mt-4 space-y-2">
                {PRO_FEATURES.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-sm font-medium leading-relaxed text-slate-200"
                  >
                    <span className="mt-0.5 shrink-0 text-emerald-400" aria-hidden="true">
                      ✓
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {isPro ? (
              <p className="rounded-lg border border-canvas-border bg-canvas-accent-soft px-3 py-2 text-sm font-medium leading-relaxed text-canvas-accent">
                You already have Pro active on {user?.email}.
              </p>
            ) : signedIn ? (
              <p className="text-xs font-medium leading-relaxed text-slate-300">
                Signed in as <span className="font-semibold text-slate-200">{user?.email}</span>
              </p>
            ) : (
              <p className="text-xs font-medium leading-relaxed text-slate-300">
                Sign in with Google to link Pro to your account.
              </p>
            )}

            {error && (
              <p
                className="rounded-lg border border-canvas-border bg-canvas-danger-soft/30 px-3 py-2 text-sm font-medium leading-relaxed text-rose-200"
                role="alert"
              >
                {error}
              </p>
            )}

            {!isPro && (
              <button
                type="button"
                onClick={() => void handleUpgrade()}
                disabled={busy}
                className="inline-flex w-full items-center justify-center rounded-xl bg-canvas-accent-muted px-4 py-3 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy
                  ? signedIn
                    ? 'Opening Razorpay…'
                    : 'Redirecting to Google…'
                  : signedIn
                    ? `Upgrade Now - ${PRO_PRICE_LABEL}${PRO_PRICE_INTERVAL}`
                    : 'Sign in & Upgrade →'}
              </button>
            )}

            {isPro && (
              <button
                type="button"
                onClick={close}
                className="inline-flex w-full items-center justify-center rounded-xl bg-canvas-accent-muted px-4 py-3 text-sm font-semibold text-canvas-text"
              >
                Continue
              </button>
            )}

            <p className="text-center text-[11px] leading-relaxed text-slate-300">
              Secure Razorpay Checkout (UPI, cards, netbanking). Free tools stay 100% offline.
            </p>
          </div>
        </div>
      </div>

      {successToast && (
        <div
          className="fixed bottom-6 left-1/2 z-[70] w-[min(100%-2rem,24rem)] -translate-x-1/2 rounded-xl border border-emerald-500/40 bg-canvas-surface px-4 py-3 text-center text-sm font-semibold leading-relaxed text-slate-200 shadow-lg"
          role="status"
        >
          {successToast}
        </div>
      )}
    </>
  );
}
