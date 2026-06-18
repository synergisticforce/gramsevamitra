import { useCallback, useState } from 'react';
import { PRO_ORDER_AMOUNT_PAISE } from '@shared/lib/proUpgrade';

export const RAZORPAY_CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

export interface RazorpayOrderResponse {
  keyId?: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  userName?: string;
  userEmail?: string;
  error?: string;
  alreadyPro?: boolean;
}

export interface RazorpaySuccessResponse {
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

export function loadRazorpayCheckoutScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay Checkout is only available in the browser.'));
  }

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

export async function createRazorpayOrder(feature: string): Promise<RazorpayOrderResponse> {
  const response = await fetch('/api/billing/razorpay-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ feature }),
  });

  const result = (await response.json()) as RazorpayOrderResponse;

  if (response.status === 401) {
    throw new Error('Please sign in with Google to upgrade to Pro.');
  }

  if (response.status === 409 && result.alreadyPro) {
    throw new Error('You already have Pro active on this account.');
  }

  if (response.status === 503) {
    throw new Error('Payment gateway temporarily unavailable. Please try again later.');
  }

  if (!response.ok || !result.orderId || !result.keyId) {
    throw new Error(result.error ?? 'Unable to start checkout.');
  }

  if (result.amount !== PRO_ORDER_AMOUNT_PAISE) {
    console.error(
      `Checkout amount mismatch: expected ${PRO_ORDER_AMOUNT_PAISE} paise, API returned ${result.amount}`,
    );
    throw new Error('Billing configuration error. Please contact support or try again later.');
  }

  return result;
}

export async function verifyRazorpayPaymentOnServer(
  payment: RazorpaySuccessResponse,
): Promise<void> {
  const response = await fetch('/api/billing/razorpay-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      razorpay_payment_id: payment.razorpay_payment_id,
      razorpay_order_id: payment.razorpay_order_id,
      razorpay_signature: payment.razorpay_signature,
    }),
  });

  const payload = (await response.json()) as { error?: string; success?: boolean };

  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? 'Payment verification failed. Please contact support.');
  }
}

export interface OpenRazorpayCheckoutInput {
  feature: string;
  description: string;
  userName?: string;
  userEmail?: string;
  onSuccess: (payment: RazorpaySuccessResponse) => void | Promise<void>;
  onDismiss?: () => void;
  onPaymentFailed?: () => void;
}

export async function openRazorpayCheckout(input: OpenRazorpayCheckoutInput): Promise<void> {
  const order = await createRazorpayOrder(input.feature);
  await loadRazorpayCheckoutScript();

  if (!window.Razorpay) {
    throw new Error('Razorpay Checkout could not be loaded. Check your connection.');
  }

  await new Promise<void>((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: order.keyId,
      amount: PRO_ORDER_AMOUNT_PAISE,
      currency: order.currency ?? 'INR',
      name: 'GramSeva Mitra',
      description: input.description,
      order_id: order.orderId,
      prefill: {
        name: input.userName ?? order.userName ?? '',
        email: input.userEmail ?? order.userEmail ?? '',
      },
      theme: { color: '#0f172a' },
      handler: (paymentResponse: RazorpaySuccessResponse) => {
        void (async () => {
          try {
            await input.onSuccess(paymentResponse);
            resolve();
          } catch (err) {
            reject(err instanceof Error ? err : new Error('Payment verification failed.'));
          }
        })();
      },
      modal: {
        ondismiss: () => {
          input.onDismiss?.();
          reject(new Error('Checkout dismissed'));
        },
      },
    });

    rzp.on('payment.failed', () => {
      input.onPaymentFailed?.();
      reject(new Error('Payment failed. Please try again or use another method.'));
    });

    rzp.open();
  });
}

export function useRazorpay() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preload = useCallback(() => {
    void loadRazorpayCheckoutScript().catch(() => {
      /* best-effort preload */
    });
  }, []);

  const startCheckout = useCallback(async (input: OpenRazorpayCheckoutInput) => {
    setError(null);
    setLoading(true);
    try {
      await openRazorpayCheckout({
        ...input,
        onDismiss: () => {
          input.onDismiss?.();
          setLoading(false);
        },
        onPaymentFailed: () => {
          input.onPaymentFailed?.();
          setError('Payment failed. Please try again or use another method.');
          setLoading(false);
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Checkout failed.';
      if (message !== 'Checkout dismissed') {
        setError(message);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { preload, startCheckout, loading, error, setError };
}
