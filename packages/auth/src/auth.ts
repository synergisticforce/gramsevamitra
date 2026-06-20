import { betterAuth } from 'better-auth';
import { emailOTP } from 'better-auth/plugins';
import { Pool } from '@neondatabase/serverless';
import { authSessionConfig } from './sessionConfig';

/**
 * Better Auth configuration for GramSeva Mitra (Astro / local tooling).
 * Production Cloudflare Functions use `functions/_lib/auth.mjs`.
 */
export function createAuth(env: AuthEnv) {
  const database = env.DATABASE_URL
    ? new Pool({ connectionString: env.DATABASE_URL })
    : env.DB;

  return betterAuth({
    appName: 'GramSeva Mitra',
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    basePath: '/api/auth',
    database,
    plugins: [
      emailOTP({
        async sendVerificationOTP({ email, otp }) {
          console.info('[auth] email OTP (dev)', email, otp);
        },
      }),
    ],
    user: {
      modelName: 'users',
      additionalFields: {
        plan: {
          type: 'string',
          required: false,
          defaultValue: 'free',
          input: false,
        },
        credits: {
          type: 'number',
          required: false,
          defaultValue: 0,
          input: false,
        },
      },
    },
    session: {
      modelName: 'sessions',
      expiresIn: authSessionConfig.expiresIn,
      updateAge: authSessionConfig.updateAge,
    },
    account: {
      modelName: 'accounts',
      accountLinking: {
        enabled: true,
        trustedProviders: ['google'],
        allowDifferentEmails: false,
      },
    },
    verification: {
      modelName: 'verifications',
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
    trustedOrigins: [
      'https://gramsevamitra.com',
      'https://utilities.gramsevamitra.com',
      'http://localhost:4321',
      'http://127.0.0.1:4321',
    ],
  });
}

/** Cloudflare Pages Function / Worker environment bindings for auth. */
export interface AuthEnv {
  /** Neon PostgreSQL connection string (preferred in production). */
  DATABASE_URL?: string;
  /** Local D1 fallback for dev preview. */
  DB?: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SES_REGION?: string;
  SES_FROM_EMAIL?: string;
  SES_ACCESS_KEY_ID?: string;
  SES_SECRET_ACCESS_KEY?: string;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
}
