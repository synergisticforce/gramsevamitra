import { useCallback, useEffect, useState } from 'react';
import {
  PRO_PRICE_INTERVAL,
  PRO_PRICE_LABEL,
  PRO_UPGRADE_OPEN_EVENT,
  type ProUpgradeDetail,
} from '@shared/lib/proUpgrade';
import { authClient } from '@gramsevamitra/auth/client';

const DEFAULT_DETAIL: ProUpgradeDetail = {
  featureName: 'Pro Feature',
  featureDescription: 'Unlock serverless AI tools — Smart Document Extractor, high-fidelity DOCX, and batch conversion.',
};

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
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          feature: detail.featureId ?? detail.featureName,
        }),
      });

      const result = (await response.json()) as {
        url?: string;
        error?: string;
        alreadyPro?: boolean;
      };

      if (response.status === 401) {
        setError('Please sign in with Google first.');
        setLoading(false);
        return;
      }

      if (response.ok && result.url) {
        window.location.href = result.url;
        return;
      }

      setError(result.error ?? 'Unable to start checkout.');
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const user = session?.user as { email?: string; plan?: string } | undefined;
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
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Pro plan</p>
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
                {loading ? 'Redirecting…' : signedIn ? 'Upgrade with Stripe →' : 'Sign in & Upgrade →'}
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
            Secure Stripe Checkout (test mode). Cancel anytime. Free tools stay 100% offline.
          </p>
        </div>
      </div>
    </div>
  );
}
