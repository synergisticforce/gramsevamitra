import { Capacitor } from '@capacitor/core';

export interface PaymentGatekeeperService {
  initiateCheckout: (paymentUrl: string) => Promise<void>;
  verifySignature: (paymentId: string, signature: string) => Promise<boolean>;
}

/**
 * Opens Razorpay (or any hosted checkout) in a native browser tab so Android
 * WebViews do not block UPI app intents (GPay / PhonePe / Paytm).
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

    // Desktop / PWA fallback — still leave the app WebView for UPI redirects.
    window.open(paymentUrl, '_blank', 'noopener,noreferrer');
  }

  /**
   * Phase 6.1 stub — real HMAC verification lands in Phase 6.2 backend wiring.
   */
  async verifySignature(paymentId: string, signature: string): Promise<boolean> {
    console.log('[PaymentGatekeeper] verifySignature stub', { paymentId, signature });
    return true;
  }
}

export const paymentGatekeeper = new PaymentGatekeeper();
