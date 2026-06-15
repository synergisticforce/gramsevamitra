import { useCallback, useEffect, useState } from 'react';
import {
  PRO_ORDER_AMOUNT_PAISE,
  PRO_PRICE_INTERVAL,
  PRO_PRICE_LABEL,
  PRO_UPGRADE_OPEN_EVENT,
  type ProUpgradeDetail,
} from '@shared/lib/proUpgrade';
import { authClient } from '@gramsevamitra/auth/client';

const RAZORPAY_CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

const DEFAULT_DETAIL: ProUpgradeDetail = {
  featureName: 'Pro Feature',
  featureDescription: 'Unlock serverless AI tools — Smart Document Extractor, high-fidelity DOCX, and batch conversion.',
};

interface RazorpayOrderResponse {
  keyId?: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  userName?: string;
  userEmail?: string;
  error?: string;
  alreadyPro?: boolean;
}

interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: () => void) => void;
    };
  }
}

function loadRazorpayCheckout(): Promise<void> {
  if (window.Razorpay) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${RAZORPAY_CHECKOUT_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Razorpay Checkout.')), {
        once: true,
      });
      if (window.Razorpay) resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = RAZORPAY_CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay Checkout.'));
    document.body.appendChild(script);
  });
}

export default function ProUpgradeModal() {
  const { data: session, isPending } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<ProUpgradeDetail>(DEFAULT_DETAIL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const custom = event as CustomEvent<ProUpgradeDetail>;
      setDetail({ ...DEFAULT_DETAIL, ...custom.detail });
      setError(null);
      setOpen(true);
    };

    window.addEventListener(PRO_UPGRADE_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(PRO_UPGRADE_OPEN_EVENT, onOpen);
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
  }, [open, close]);

  const signInWithGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: window.location.href,
      });
    } catch {
      setError('Could not start Google sign-in. Please try again.');
      setLoading(false);
    }
  };

  const startCheckout = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch('/api/billing/razorpay-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          feature: detail.featureId ?? detail.featureName,
        }),
      });

      const result = (await response.json()) as RazorpayOrderResponse;

      if (response.status === 401) {
        setError('Please sign in with Google first.');
        setLoading(false);
        return;
      }

      if (response.status === 409 && result.alreadyPro) {
        setError('You already have Pro active on this account.');
        setLoading(false);
        return;
      }

      if (response.status === 503 && result.error?.includes('not configured')) {
        setError(
          'Pro billing is not registered on the server yet. Ask support to set RAZORPAY_KEY_SECRET in Cloudflare Pages.',
        );
        setLoading(false);
        return;
      }

      if (!response.ok || !result.orderId || !result.keyId) {
        setError(result.error ?? 'Unable to start checkout.');
        setLoading(false);
        return;
      }

      if (result.amount !== PRO_ORDER_AMOUNT_PAISE) {
        console.error(
          `Checkout amount mismatch: expected ${PRO_ORDER_AMOUNT_PAISE} paise, API returned ${result.amount}`,
        );
        setError('Billing configuration error. Please contact support or try again later.');
        setLoading(false);
        return;
      }

      await loadRazorpayCheckout();

      if (!window.Razorpay) {
        setError('Razorpay Checkout could not be loaded. Check your connection.');
        setLoading(false);
        return;
      }

      const rzp = new window.Razorpay({
        key: result.keyId,
        amount: PRO_ORDER_AMOUNT_PAISE,
        currency: result.currency ?? 'INR',
        name: 'GramSeva Mitra',
        description: `${detail.featureName} — Pro Plan`,
        order_id: result.orderId,
        prefill: {
          name: result.userName ?? '',
          email: result.userEmail ?? '',
        },
        theme: { color: '#0f172a' },
        handler: (paymentResponse: RazorpaySuccessResponse) => {
          const params = new URLSearchParams({
            payment_id: paymentResponse.razorpay_payment_id,
            order_id: paymentResponse.razorpay_order_id,
          });
          window.location.href = `/billing/success?${params.toString()}`;
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },
      });

      rzp.on('payment.failed', () => {
        setError('Payment failed. Please try again or use another method.');
        setLoading(false);
      });

      setLoading(false);
      rzp.open();
    } catch {
      setError('Network error. Check your connection and try again.');
      setLoading(false);
    }
  };

  if (!open) return null;

  const user = session?.user as { email?: string; name?: string; plan?: string } | undefined;
  const isPro = user?.plan === 'pro';
  const signedIn = Boolean(user);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center"
      role="presentation"
      onClick={close}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pro-upgrade-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white px-5 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                <span aria-hidden="true">⚡</span> Pro
              </p>
              <h2 id="pro-upgrade-title" className="mt-2 text-xl font-bold text-slate-900">
                {detail.featureName}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                {detail.featureDescription ?? DEFAULT_DETAIL.featureDescription}
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-500 transition hover:bg-slate-50"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Pro plan</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900">
              {PRO_PRICE_LABEL}
              <span className="text-base font-semibold text-slate-500">{PRO_PRICE_INTERVAL}</span>
            </p>
            <ul className="mt-3 space-y-1.5 text-xs text-slate-700">
              <li>• Smart Document Extractor (CSV / JSON / DOCX)</li>
              <li>• Serverless AI routing — PaddleOCR + vision models</li>
              <li>• Batch 50+ conversions &amp; priority GPU queue</li>
            </ul>
          </div>

          {isPro ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              You already have Pro active on {user?.email}.
            </p>
          ) : signedIn ? (
            <p className="text-xs text-slate-500">
              Signed in as <span className="font-medium text-slate-700">{user?.email}</span>
            </p>
          ) : (
            <p className="text-xs text-slate-500">Sign in with Google to link Pro to your account.</p>
          )}

          {error && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            {!signedIn && !isPending ? (
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                disabled={loading}
                className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Continue with Google
              </button>
            ) : null}

            {!isPro ? (
              <button
                type="button"
                onClick={() => void (signedIn ? startCheckout() : signInWithGoogle())}
                disabled={loading || isPending}
                className="inline-flex flex-1 items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {loading ? 'Opening checkout…' : signedIn ? 'Pay with Razorpay →' : 'Sign in & Upgrade →'}
              </button>
            ) : (
              <button
                type="button"
                onClick={close}
                className="inline-flex flex-1 items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Continue
              </button>
            )}
          </div>

          <p className="text-center text-[11px] leading-relaxed text-slate-400">
            Secure Razorpay Checkout (UPI, cards, netbanking). Free tools stay 100% offline.
          </p>
        </div>
      </div>
    </div>
  );
}
