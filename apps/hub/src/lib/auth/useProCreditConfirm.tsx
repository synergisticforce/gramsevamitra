import { useCallback, useState } from 'react';
import {
  buildCreditQuote,
  fetchUserCredits,
  type CreditQuote,
  type ProOperationId,
} from '../../lib/auth/creditCheck';
import ProCreditConfirmModal from '../../components/pro/ProCreditConfirmModal';

interface PendingProOperation {
  operationId: ProOperationId;
  operationLabel: string;
  execute: () => void | Promise<void>;
}

export function useProCreditConfirm() {
  const [pending, setPending] = useState<PendingProOperation | null>(null);
  const [quote, setQuote] = useState<CreditQuote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const close = useCallback(() => {
    if (confirmBusy) return;
    setPending(null);
    setQuote(null);
    setQuoteError(null);
  }, [confirmBusy]);

  const requestProConfirm = useCallback(
    async (operationId: ProOperationId, operationLabel: string, execute: () => void | Promise<void>) => {
      setLoadingQuote(true);
      setQuoteError(null);
      setPending({ operationId, operationLabel, execute });

      try {
        const balance = await fetchUserCredits();
        setQuote(buildCreditQuote(operationId, balance));
      } catch (err) {
        setQuoteError(err instanceof Error ? err.message : 'Could not load AI Credits.');
        setQuote(null);
      } finally {
        setLoadingQuote(false);
      }
    },
    [],
  );

  const confirm = useCallback(async () => {
    if (!pending || !quote?.canAfford || confirmBusy) return;

    setConfirmBusy(true);
    try {
      await pending.execute();
      close();
    } finally {
      setConfirmBusy(false);
    }
  }, [close, confirmBusy, pending, quote?.canAfford]);

  const modal =
    pending != null ? (
      <ProCreditConfirmModal
        open
        operationLabel={pending.operationLabel}
        quote={quote}
        loadingQuote={loadingQuote}
        quoteError={quoteError}
        confirmBusy={confirmBusy}
        onConfirm={() => void confirm()}
        onCancel={close}
      />
    ) : null;

  return { requestProConfirm, proCreditModal: modal };
}
