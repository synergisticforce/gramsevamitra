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

export interface PaymentStatusResponse {
  orderId?: string;
  processed?: boolean;
  plan?: string;
  proActive?: boolean;
  error?: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response?: { error?: { description?: string } }) => void) => void;
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
    throw new Error('Please sign in to upgrade to Pro.');
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

export async function fetchPaymentStatus(orderId?: string): Promise<PaymentStatusResponse> {
  const query = orderId ? `?orderId=${encodeURIComponent(orderId)}` : '';
  const response = await fetch(`/api/billing/payment-status${query}`, {
    credentials: 'include',
  });
  return (await response.json()) as PaymentStatusResponse;
}

export interface VerifyPaymentResponse {
  proActive?: boolean;
  plan?: string;
  duplicate?: boolean;
  alreadyPro?: boolean;
  error?: string;
  code?: string;
}

/** Server-side checkout signature verification — activates Pro without waiting for webhook. */
export async function verifyRazorpayPayment(
  payment: RazorpaySuccessResponse,
): Promise<VerifyPaymentResponse> {
  const response = await fetch('/api/billing/verify-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      orderId: payment.razorpay_order_id,
      paymentId: payment.razorpay_payment_id,
      signature: payment.razorpay_signature,
    }),
  });

  const result = (await response.json()) as VerifyPaymentResponse;

  if (response.status === 401) {
    throw new Error('Please sign in to complete your Pro upgrade.');
  }

  if (!response.ok && !result.proActive) {
    throw new Error(result.error ?? 'Payment verification failed.');
  }

  return result;
}

export async function pollProActivation(
  orderId: string,
  options?: {
    maxMs?: number;
    intervalMs?: number;
    onSessionRefresh?: () => Promise<void>;
    payment?: RazorpaySuccessResponse;
  },
): Promise<boolean> {
  if (options?.payment) {
    try {
      const verified = await verifyRazorpayPayment(options.payment);
      if (verified.proActive || verified.alreadyPro) {
        await options.onSessionRefresh?.();
        return true;
      }
    } catch (err) {
      console.warn('[billing] Server verify-payment did not complete immediately:', err);
    }
  }

  const maxMs = options?.maxMs ?? 45000;
  const intervalMs = options?.intervalMs ?? 1500;
  const started = Date.now();

  while (Date.now() - started < maxMs) {
    if (options?.onSessionRefresh) {
      await options.onSessionRefresh();
    }

    const status = await fetchPaymentStatus(orderId);
    if (status.proActive) {
      return true;
    }

    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
  }

  return false;
}

export interface OpenRazorpayCheckoutInput {
  feature: string;
  description: string;
  userName?: string;
  userEmail?: string;
  onSuccess: (payment: RazorpaySuccessResponse) => void | Promise<void>;
  onDismiss?: () => void;
  onPaymentFailed?: (message: string) => void;
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
            reject(err instanceof Error ? err : new Error('Payment confirmation failed.'));
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

    rzp.on('payment.failed', (response) => {
      const message = 'Payment failed. Please try again or use another method.';
      input.onPaymentFailed?.(message);
      reject(new Error(message));
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
        onPaymentFailed: (message) => {
          input.onPaymentFailed?.(message);
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
