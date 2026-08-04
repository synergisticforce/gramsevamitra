import { Capacitor } from '@capacitor/core';
import { apiUrl } from '../lib/apiBase';

export interface PaymentGatekeeperService {
  initiateCheckout: (paymentUrl: string) => Promise<void>;
  verifySignature: (paymentId: string, signature: string, orderId: string) => Promise<boolean>;
}

export interface CheckoutVerificationInput {
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface VerifyPaymentResult {
  proActive: boolean;
  plan: string;
  alreadyPro?: boolean;
  duplicate?: boolean;
}

export interface MobileCheckoutSession {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  checkoutUrl: string;
}

/**
 * Opens Razorpay in a native browser tab (UPI-safe) and confirms Pro via
 * Cloudflare Pages Function `POST /api/billing/verify-payment`.
 */
export class PaymentGatekeeper implements PaymentGatekeeperService {
  async initiateCheckout(paymentUrl: string): Promise<void> {
    if (!paymentUrl || typeof paymentUrl !== 'string') {
      throw new Error('A valid payment URL is required to start checkout.');
    }

    if (Capacitor.isNativePlatform()) {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({
        url: paymentUrl,
        presentationStyle: 'popover',
      });
      return;
    }

    window.open(paymentUrl, '_blank', 'noopener,noreferrer');
  }

  /**
   * Server-side HMAC verification of `order_id|payment_id` + Pro activation.
   * Never trusts client-side crypto alone.
   */
  async verifySignature(paymentId: string, signature: string, orderId: string): Promise<boolean> {
    const result = await this.confirmProPayment({
      orderId,
      paymentId,
      signature,
    });
    return Boolean(result.proActive || result.alreadyPro);
  }

  async confirmProPayment(input: CheckoutVerificationInput): Promise<VerifyPaymentResult> {
    if (!input.orderId || !input.paymentId || !input.signature) {
      throw new Error('orderId, paymentId, and signature are required for verification.');
    }

    const response = await fetch(apiUrl('/api/billing/verify-payment'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        orderId: input.orderId,
        paymentId: input.paymentId,
        signature: input.signature,
      }),
    });

    const result = (await response.json()) as VerifyPaymentResult & {
      error?: string;
      code?: string;
    };

    if (response.status === 401) {
      throw new Error(result.error ?? 'Sign in required to verify payment.');
    }

    if (!response.ok && !result.proActive && !result.alreadyPro) {
      throw new Error(result.error ?? 'Payment verification failed.');
    }

    return {
      proActive: Boolean(result.proActive || result.alreadyPro),
      plan: result.plan ?? (result.proActive || result.alreadyPro ? 'pro' : 'free'),
      alreadyPro: result.alreadyPro,
      duplicate: result.duplicate,
    };
  }

  /** Create a Razorpay order for the signed-in user and return a same-origin checkout URL. */
  async createMobileCheckoutSession(feature = 'mobile_pro_upgrade'): Promise<MobileCheckoutSession> {
    const response = await fetch(apiUrl('/api/billing/razorpay-order'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ feature }),
    });

    const result = (await response.json()) as {
      keyId?: string;
      orderId?: string;
      amount?: number;
      currency?: string;
      error?: string;
      alreadyPro?: boolean;
      code?: string;
    };

    if (response.status === 401) {
      throw new Error(result.error ?? 'Sign in required to upgrade to Pro.');
    }

    if (response.status === 409 && result.alreadyPro) {
      throw new Error('You already have Pro active on this account.');
    }

    if (!response.ok || !result.keyId || !result.orderId || !result.amount) {
      throw new Error(result.error ?? 'Unable to create payment order.');
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://gramsevamitra.com';
    const checkoutUrl = new URL('/billing/mobile-checkout/', origin);
    checkoutUrl.searchParams.set('keyId', result.keyId);
    checkoutUrl.searchParams.set('orderId', result.orderId);
    checkoutUrl.searchParams.set('amount', String(result.amount));
    checkoutUrl.searchParams.set('currency', result.currency ?? 'INR');

    return {
      keyId: result.keyId,
      orderId: result.orderId,
      amount: result.amount,
      currency: result.currency ?? 'INR',
      checkoutUrl: checkoutUrl.toString(),
    };
  }

  /**
   * After the Capacitor Browser tab closes, poll until webhook/verify activated Pro.
   */
  async waitForProActivation(options?: {
    orderId?: string;
    maxMs?: number;
    intervalMs?: number;
  }): Promise<boolean> {
    const maxMs = options?.maxMs ?? 45000;
    const intervalMs = options?.intervalMs ?? 1500;
    const started = Date.now();

    while (Date.now() - started < maxMs) {
      const query = options?.orderId
        ? `?orderId=${encodeURIComponent(options.orderId)}`
        : '';
      const response = await fetch(apiUrl(`/api/billing/payment-status${query}`), {
        credentials: 'include',
      });
      const status = (await response.json()) as {
        proActive?: boolean;
        plan?: string;
      };
      if (status.proActive || status.plan === 'pro') {
        return true;
      }
      await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
    }

    return false;
  }

  /** Resolves when the Capacitor Browser tab is closed (no-op on web). */
  async waitForBrowserClosed(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const { Browser } = await import('@capacitor/browser');
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        void listener.then((handle) => handle.remove()).catch(() => undefined);
        resolve();
      };

      const listener = Browser.addListener('browserFinished', () => {
        finish();
      });

      // Safety timeout if the finished event is missed
      window.setTimeout(finish, 120000);
    });
  }
}

export const paymentGatekeeper = new PaymentGatekeeper();
