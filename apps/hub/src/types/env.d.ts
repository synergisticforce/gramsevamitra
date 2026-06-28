/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly SSR: boolean;
  readonly BASE_URL: string;
  readonly PUBLIC_RAZORPAY_KEY_ID?: string;
  readonly PUBLIC_INSTAMOJO_PAYMENT_LINK?: string;
  readonly PUBLIC_OPTIMIZER_PRICE_PAISE?: string;
  readonly PUBLIC_RESUME_SINGLE_PRICE_PAISE?: string;
  readonly PUBLIC_RESUME_MONTHLY_PRICE_PAISE?: string;
  readonly PUBLIC_PAYMENTS_ENABLED?: string;
  readonly PUBLIC_ROBOTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
