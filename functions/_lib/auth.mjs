import { env as workersEnv } from 'cloudflare:workers';
import { betterAuth } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { expireCookie, setSessionCookie } from 'better-auth/cookies';
import { emailOTP, magicLink } from 'better-auth/plugins';
import { Pool } from '@neondatabase/serverless';
import { authSessionConfig } from './authSession.mjs';
import { getRuntimeEnv, hasD1Binding, readEnvFromContext, readEnvString } from './runtimeEnv.mjs';
import { sendEmailOtp, sendMagicLinkEmail } from './sesMail.mjs';

/**
 * @param {Record<string, unknown> | undefined} context
 * @param {string} key
 */
function resolveBinding(context, key) {
  const fromContext = readEnvFromContext(context, key);
  if (fromContext) return fromContext;
  return readEnvString(workersEnv, key);
}

/**
 * @param {Record<string, unknown> | undefined} context
 */
function resolveDbBinding(context) {
  const databaseUrl = resolveBinding(context, 'DATABASE_URL');
  if (databaseUrl) {
    return new Pool({ connectionString: databaseUrl });
  }

  const handlerEnv = context?.env ?? context?.cloudflare?.env;
  if (hasD1Binding(handlerEnv)) {
    return handlerEnv.DB;
  }
  if (hasD1Binding(workersEnv)) {
    return workersEnv.DB;
  }
  return undefined;
}

/**
 * @param {Record<string, unknown>} env
 */
function buildAuthPlugins(env) {
  return [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        try {
          await sendMagicLinkEmail(env, { email, url });
        } catch (err) {
          if (err instanceof Error && err.code === 'SES_SANDBOX_ERROR') {
            const sandbox = new Error('SES_SANDBOX_ERROR');
            sandbox.code = 'SES_SANDBOX_ERROR';
            throw sandbox;
          }
          throw err;
        }
      },
    }),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        try {
          await sendEmailOtp(env, { email, otp, type });
        } catch (err) {
          if (err instanceof Error && err.code === 'SES_SANDBOX_ERROR') {
            const sandbox = new Error('SES_SANDBOX_ERROR');
            sandbox.code = 'SES_SANDBOX_ERROR';
            throw sandbox;
          }
          throw err;
        }
      },
    }),
  ];
}

/**
 * Runtime Better Auth factory for Cloudflare Pages Functions / Workers.
 * @param {Record<string, unknown> | undefined} context Handler context from onRequest
 */
export function createAuth(context) {
  const handlerEnv = getRuntimeEnv(context);
  const db = resolveDbBinding(context);

  if (!db) {
    console.error('[auth] Database missing — set DATABASE_URL (Neon) or bind D1', {
      hasDatabaseUrl: Boolean(resolveBinding(context, 'DATABASE_URL')),
      handlerHasDb: hasD1Binding(handlerEnv),
      workersHasDb: hasD1Binding(workersEnv),
    });
  }

  return betterAuth({
    appName: 'GramSeva Mitra',
    baseURL: resolveBinding(context, 'BETTER_AUTH_URL'),
    secret: resolveBinding(context, 'BETTER_AUTH_SECRET'),
    basePath: '/api/auth',
    database: db,
    plugins: buildAuthPlugins(handlerEnv),
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
    },
    verification: {
      modelName: 'verifications',
    },
    socialProviders: {
      google: {
        clientId: resolveBinding(context, 'GOOGLE_CLIENT_ID'),
        clientSecret: resolveBinding(context, 'GOOGLE_CLIENT_SECRET'),
      },
    },
    trustedOrigins: [
      'https://gramsevamitra.com',
      'https://utilities.gramsevamitra.com',
      'http://localhost:4321',
      'http://127.0.0.1:4321',
    ],
    hooks: {
      after: [
        {
          matcher(ctx) {
            const path = ctx.path ?? '';
            return (
              path === '/sign-in/email-otp' ||
              path.includes('/callback/') ||
              path === '/magic-link/verify'
            );
          },
          handler: createAuthMiddleware(async (ctx) => {
            if (!ctx.context.newSession) return;
            expireCookie(ctx, ctx.context.authCookies.dontRememberToken);
            await setSessionCookie(ctx, ctx.context.newSession, false);
          }),
        },
      ],
    },
  });
}
