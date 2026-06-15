import type { CreditQuote } from '../../lib/auth/creditCheck';

interface Props {
  open: boolean;
  operationLabel: string;
  quote: CreditQuote | null;
  loadingQuote?: boolean;
  quoteError?: string | null;
  confirmBusy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ProCreditConfirmModal({
  open,
  operationLabel,
  quote,
  loadingQuote = false,
  quoteError = null,
  confirmBusy = false,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  const canConfirm = Boolean(quote?.canAfford) && !loadingQuote && !confirmBusy;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-canvas-accent-muted/50 p-4 backdrop-blur-sm sm:items-center"
      role="presentation"
      onClick={() => {
        if (!confirmBusy) onCancel();
      }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-canvas-border bg-canvas-surface shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pro-credit-confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-canvas-border bg-canvas-elevated px-5 py-5">
          <p className="inline-flex items-center gap-1 rounded-full bg-canvas-accent-muted px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-canvas-text">
            <span aria-hidden="true">⚡</span> Pro · AI Credits
          </p>
          <h2 id="pro-credit-confirm-title" className="mt-2 text-xl font-bold text-canvas-text">
            Confirm {operationLabel}
          </h2>
          <p className="mt-1 text-sm font-medium leading-relaxed text-slate-200">
            Review the credit cost before cloud processing begins. No charges apply until you confirm.
          </p>
        </div>

        <div className="space-y-4 px-5 py-5">
          {loadingQuote && (
            <p className="text-sm font-medium leading-relaxed text-slate-200" role="status">
              Loading your AI Credit balance…
            </p>
          )}

          {quoteError && (
            <p className="rounded-lg border border-canvas-border bg-canvas-danger-soft/30 px-3 py-2 text-sm text-rose-200" role="alert">
              {quoteError}
            </p>
          )}

          {quote && !loadingQuote && (
            <div
              className={`rounded-xl border px-4 py-3 ${
                quote.canAfford ? 'border-canvas-border bg-canvas-accent-soft/80' : 'border-canvas-border bg-canvas-elevated/80'
              }`}
            >
              <p className="text-sm font-semibold text-canvas-text">{quote.message}</p>
              {!quote.canAfford && (
                <p className="mt-2 text-xs text-slate-200">
                  Upgrade or wait for your monthly credit refresh to run this Pro operation.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <button
              type="button"
              disabled={!canConfirm}
              onClick={onConfirm}
              className="inline-flex items-center justify-center rounded-xl bg-canvas-accent-muted px-4 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {confirmBusy ? 'Processing…' : 'Confirm & Process'}
            </button>
            <button
              type="button"
              disabled={confirmBusy}
              onClick={onCancel}
              className="inline-flex items-center justify-center rounded-xl border border-canvas-border px-4 py-2.5 text-sm font-semibold text-canvas-muted transition hover:bg-canvas-elevated disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
