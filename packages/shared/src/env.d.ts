/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_RAZORPAY_KEY_ID?: string;
  readonly PUBLIC_INSTAMOJO_PAYMENT_LINK?: string;
  readonly PUBLIC_OPTIMIZER_PRICE_PAISE?: string;
  readonly PUBLIC_RESUME_SINGLE_PRICE_PAISE?: string;
  readonly PUBLIC_RESUME_MONTHLY_PRICE_PAISE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
