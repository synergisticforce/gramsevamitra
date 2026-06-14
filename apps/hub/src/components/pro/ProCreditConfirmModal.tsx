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
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center"
      role="presentation"
      onClick={() => {
        if (!confirmBusy) onCancel();
      }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pro-credit-confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white px-5 py-5">
          <p className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            <span aria-hidden="true">⚡</span> Pro · AI Credits
          </p>
          <h2 id="pro-credit-confirm-title" className="mt-2 text-xl font-bold text-slate-900">
            Confirm {operationLabel}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Review the credit cost before cloud processing begins. No charges apply until you confirm.
          </p>
        </div>

        <div className="space-y-4 px-5 py-5">
          {loadingQuote && (
            <p className="text-sm text-slate-500" role="status">
              Loading your AI Credit balance…
            </p>
          )}

          {quoteError && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
              {quoteError}
            </p>
          )}

          {quote && !loadingQuote && (
            <div
              className={`rounded-xl border px-4 py-3 ${
                quote.canAfford ? 'border-emerald-200 bg-emerald-50/80' : 'border-amber-200 bg-amber-50/80'
              }`}
            >
              <p className="text-sm font-semibold text-slate-900">{quote.message}</p>
              {!quote.canAfford && (
                <p className="mt-2 text-xs text-amber-900">
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
              className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {confirmBusy ? 'Processing…' : 'Confirm & Process'}
            </button>
            <button
              type="button"
              disabled={confirmBusy}
              onClick={onCancel}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
