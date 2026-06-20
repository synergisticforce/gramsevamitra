import { useCallback, useEffect, useState } from 'react';
import { authClient } from '@gramsevamitra/auth/client';
import {
  PRO_PRICE_INTERVAL,
  PRO_PRICE_LABEL,
  PRO_UPGRADE_OPEN_EVENT,
  type ProUpgradeDetail,
} from '@shared/lib/proUpgrade';
import { openAuthModal } from '../../lib/auth/triggers';
import { prepareAuthRedirectForProUpgrade } from '../../lib/auth/prepareAuthRedirect';
import {
  pollProActivation,
  useRazorpay,
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
  const { data: session, refetch } = authClient.useSession();
  const { preload, startCheckout, loading, error, setError } = useRazorpay();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<ProUpgradeDetail>(DEFAULT_DETAIL);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  const close = useCallback(() => {
    if (loading || verifyingPayment) return;
    setOpen(false);
    setError(null);
    setSuccessToast(null);
  }, [loading, setError, verifyingPayment]);

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
    void refetch?.();
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
  }, [close, open, preload, refetch]);

  const promptSignIn = async () => {
    setError(null);
    try {
      await prepareAuthRedirectForProUpgrade();
      openAuthModal();
    } catch {
      setError('Could not prepare sign-in. Please try again.');
    }
  };

  const refreshSession = useCallback(async () => {
    await refetch?.();
  }, [refetch]);

  const handlePaymentSuccess = useCallback(
    async (payment: RazorpaySuccessResponse) => {
      setVerifyingPayment(true);
      setError(null);

      const activated = await pollProActivation(payment.razorpay_order_id, {
        onSessionRefresh: refreshSession,
      });

      if (!activated) {
        setVerifyingPayment(false);
        setError(
          'Payment received — Pro activation is still processing. Refresh in a moment or contact support if this persists.',
        );
        return;
      }

      await refreshSession();
      setVerifyingPayment(false);
      setSuccessToast('Welcome to Pro! Premium AI engines are now unlocked.');
      window.setTimeout(() => {
        setOpen(false);
        setSuccessToast(null);
        window.location.reload();
      }, 2200);
    },
    [refreshSession, setError],
  );

  const handleUpgrade = async () => {
    const user = session?.user as { email?: string; name?: string; plan?: string } | undefined;
    if (!user) {
      await promptSignIn();
      return;
    }

    try {
      await startCheckout({
        feature: detail.featureId ?? detail.featureName,
        description: `${detail.featureName} — Pro Annual Pass`,
        userName: user.name,
        userEmail: user.email,
        onSuccess: handlePaymentSuccess,
        onPaymentFailed: (message) => setError(message),
      });
    } catch {
      /* errors surfaced via hook */
    }
  };

  if (!open) return null;

  const user = session?.user as { email?: string; name?: string; plan?: string } | undefined;
  const isPro = user?.plan === 'pro';
  const signedIn = Boolean(user);
  const checkoutBusy = loading || verifyingPayment;

  return (
    <>
      <div
        className="fixed inset-0 z-[60] flex items-end justify-center bg-canvas-accent-muted/50 p-4 backdrop-blur-sm sm:items-center"
        role="presentation"
        onClick={close}
      >
        <div
          className="relative w-full max-w-md overflow-hidden rounded-2xl border border-canvas-border bg-canvas-surface shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pro-pricing-title"
          onClick={(event) => event.stopPropagation()}
        >
          {verifyingPayment && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-canvas-surface/95 px-6 text-center backdrop-blur-sm">
              <div
                className="h-10 w-10 animate-spin rounded-full border-2 border-canvas-border border-t-canvas-accent"
                aria-hidden="true"
              />
              <p className="text-sm font-semibold text-canvas-text">Confirming your Pro upgrade…</p>
              <p className="text-xs font-medium text-slate-300">
                Waiting for secure payment verification. Do not close this window.
              </p>
            </div>
          )}

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
                disabled={checkoutBusy}
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
                Sign in with Google or email to link Pro to your account.
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

            {!isPro && !signedIn && (
              <button
                type="button"
                onClick={() => void promptSignIn()}
                className="inline-flex w-full items-center justify-center rounded-xl bg-canvas-accent-muted px-4 py-3 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40"
              >
                Sign in to continue →
              </button>
            )}

            {!isPro && signedIn && (
              <button
                type="button"
                onClick={() => void handleUpgrade()}
                disabled={checkoutBusy}
                className="inline-flex w-full items-center justify-center rounded-xl bg-canvas-accent-muted px-4 py-3 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {checkoutBusy
                  ? verifyingPayment
                    ? 'Confirming payment…'
                    : 'Opening Razorpay…'
                  : `Upgrade Now - ${PRO_PRICE_LABEL}${PRO_PRICE_INTERVAL}`}
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
