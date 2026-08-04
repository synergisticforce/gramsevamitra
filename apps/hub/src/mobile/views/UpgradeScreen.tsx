import { useState } from 'react';
import { PRO_PRICE_INTERVAL, PRO_PRICE_LABEL } from '@shared/lib/proUpgrade';
import { paymentGatekeeper } from '../../shared/services/PaymentGatekeeper';

const TEST_RAZORPAY_LINK = 'https://rzp.io/l/test-link';

const PRO_FEATURES = [
  'Unlock Gemini AI conversions: PDF to Word / Excel',
  'Priority cloud layout reconstruction for large scans',
  'Unlimited complex document exports',
  'Offline vault + native scan / trim tools included',
] as const;

export default function UpgradeScreen() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const handleUpgrade = async () => {
    setBusy(true);
    setError(null);
    setStatus(null);

    try {
      await paymentGatekeeper.initiateCheckout(TEST_RAZORPAY_LINK);
      setStatus('Secure checkout opened. Complete UPI or card payment, then return to the app.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to open checkout.';
      console.warn('[UpgradeScreen] checkout failed:', message);
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-6 sm:px-5">
      <header className="space-y-2">
        <p className="inline-flex items-center gap-1 rounded-full bg-canvas-accent-muted px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-canvas-text">
          Pro
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-canvas-text">
          Upgrade GramSeva Mitra
        </h1>
        <p className="text-sm font-medium leading-relaxed text-slate-300">
          Keep free tools offline forever. Unlock cloud AI only when you need advanced document
          conversions — paid securely via UPI or cards.
        </p>
      </header>

      <div className="rounded-2xl border border-canvas-border bg-canvas-surface px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Annual Pass</p>
        <p className="mt-1 text-3xl font-extrabold tabular-nums text-canvas-text">
          {PRO_PRICE_LABEL}
          <span className="text-base font-semibold text-slate-300">{PRO_PRICE_INTERVAL}</span>
        </p>

        <ul className="mt-5 space-y-2.5">
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

      <button
        type="button"
        onClick={() => void handleUpgrade()}
        disabled={busy}
        className="inline-flex w-full items-center justify-center rounded-2xl bg-canvas-accent-muted px-6 py-4 text-base font-bold text-canvas-text transition hover:bg-canvas-accent/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Opening secure checkout…' : 'Upgrade to Pro (UPI/Cards)'}
      </button>

      <p className="text-center text-[11px] font-medium leading-relaxed text-slate-300">
        Checkout opens in a native browser tab so GPay, PhonePe, and cards work reliably on Android.
      </p>

      {error && (
        <p
          className="rounded-xl border border-canvas-border bg-canvas-danger-soft/30 px-3 py-2 text-sm font-medium text-rose-200"
          role="alert"
        >
          {error}
        </p>
      )}
      {status && (
        <p
          className="rounded-xl border border-emerald-500/40 bg-canvas-accent-soft px-3 py-2 text-sm font-medium text-canvas-text"
          role="status"
        >
          {status}
        </p>
      )}
    </section>
  );
}
