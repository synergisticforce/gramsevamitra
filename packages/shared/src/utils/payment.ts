declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  handler: (response: RazorpayResponse) => void;
  modal?: { ondismiss?: () => void };
  theme?: { color: string };
  prefill?: { email?: string; contact?: string };
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (response: unknown) => void) => void;
}

export interface PaymentConfig {
  amountPaise: number;
  productName: string;
  description: string;
  storageKey: string;
  onSuccess: () => void;
  onError?: (message: string) => void;
}

const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

export function markPaid(storageKey: string): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ paid: true, at: Date.now() }));
  } catch {
    /* storage unavailable */
  }
}

export function isPaid(storageKey: string): boolean {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { paid?: boolean };
    return parsed.paid === true;
  } catch {
    return false;
  }
}

export async function initiatePayment(config: PaymentConfig): Promise<void> {
  const keyId = import.meta.env.PUBLIC_RAZORPAY_KEY_ID as string | undefined;
  const instamojoLink = import.meta.env.PUBLIC_INSTAMOJO_PAYMENT_LINK as string | undefined;

  if (keyId && keyId.startsWith('rzp_')) {
    try {
      await loadScript(RAZORPAY_SCRIPT);
      if (!window.Razorpay) {
        throw new Error('Razorpay SDK failed to initialize');
      }

      const rzp = new window.Razorpay({
        key: keyId,
        amount: config.amountPaise,
        currency: 'INR',
        name: 'GramSeva Mitra',
        description: config.description,
        theme: { color: '#059669' },
        handler: (response) => {
          if (response.razorpay_payment_id) {
            markPaid(config.storageKey);
            config.onSuccess();
          }
        },
        modal: {
          ondismiss: () => config.onError?.('Payment cancelled'),
        },
      });
      rzp.open();
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Razorpay checkout failed';
      config.onError?.(message);
    }
  }

  if (instamojoLink && instamojoLink.startsWith('http')) {
    const confirmed = window.confirm(
      `You will be redirected to Instamojo to pay ₹${config.amountPaise / 100} for ${config.productName}. Continue?`
    );
    if (confirmed) {
      window.open(instamojoLink, '_blank', 'noopener,noreferrer');
      const verified = window.confirm(
        'After completing payment on Instamojo, click OK to unlock access. (In production, verify via webhook.)'
      );
      if (verified) {
        markPaid(config.storageKey);
        config.onSuccess();
      }
    }
    return;
  }

  config.onError?.('Payment gateway temporarily unavailable. Please try again later.');
}

export function getUsageCount(storageKey: string): number {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { count?: number };
    return typeof parsed.count === 'number' ? parsed.count : 0;
  } catch {
    return 0;
  }
}

export function incrementUsageCount(storageKey: string): number {
  const next = getUsageCount(storageKey) + 1;
  try {
    localStorage.setItem(storageKey, JSON.stringify({ count: next, at: Date.now() }));
  } catch {
    /* storage unavailable */
  }
  return next;
}
