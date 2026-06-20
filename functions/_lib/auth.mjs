import { env as workersEnv } from 'cloudflare:workers';
import { betterAuth } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { expireCookie, setSessionCookie } from 'better-auth/cookies';
import { emailOTP } from 'better-auth/plugins';
import { Pool } from '@neondatabase/serverless';
import { logAuthBindingDiagnostics } from './authBindingDiagnostics.mjs';
import { authSessionConfig } from './authSession.mjs';
import { getRuntimeEnv, hasD1Binding, readEnvFromContext, readEnvString } from './runtimeEnv.mjs';
import { sendEmailOtp } from './sesMail.mjs';

const REQUIRED_AUTH_BINDINGS = ['BETTER_AUTH_URL', 'BETTER_AUTH_SECRET', 'DATABASE_URL'];

/**
 * Resolve auth secrets/bindings from Cloudflare handler context layers (never process.env).
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
 * @returns {string | null} Missing binding key, or null when configured.
 */
export function validateAuthBindings(context) {
  for (const key of REQUIRED_AUTH_BINDINGS) {
    if (!resolveBinding(context, key)) return key;
  }
  return null;
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
 * Apply "Keep me signed in" session cookie policy after OTP or OAuth sign-in.
 * Better Auth v1.6+ expects hooks.after to be a single middleware function, not an array.
 */
const rememberMeAfterHook = createAuthMiddleware(async (ctx) => {
  const path = ctx.path ?? '';
  const isEmailOtpSignIn = path === '/sign-in/email-otp';
  const isOAuthCallback = path.includes('/callback/');
  if (!isEmailOtpSignIn && !isOAuthCallback) return;
  if (!ctx.context.newSession) return;

  let dontRememberMe = false;

  if (isEmailOtpSignIn) {
    dontRememberMe = ctx.body?.rememberMe === false;
  } else if (isOAuthCallback) {
    const dontRememberCookie = await ctx.getSignedCookie(
      ctx.context.authCookies.dontRememberToken.name,
      ctx.context.secret,
    );
    dontRememberMe = Boolean(dontRememberCookie);
  }

  if (!dontRememberMe) {
    expireCookie(ctx, ctx.context.authCookies.dontRememberToken);
  }

  await setSessionCookie(ctx, ctx.context.newSession, dontRememberMe);
});

/**
 * Runtime Better Auth factory for Cloudflare Pages Functions / Workers.
 * Bindings are read from `context.env` (and sibling layers) on every request.
 * @param {Record<string, unknown> | undefined} context Handler context from onRequest
 */
export function createAuth(context) {
  const handlerEnv = getRuntimeEnv(context);
  const db = resolveDbBinding(context);
  const authSecret = resolveBinding(context, 'BETTER_AUTH_SECRET');
  const authUrl = resolveBinding(context, 'BETTER_AUTH_URL');
  const missingBinding = validateAuthBindings(context);

  if (missingBinding || !db) {
    logAuthBindingDiagnostics(context, '[auth] createAuth missing bindings');
    console.error('[auth] Auth bindings incomplete — check Cloudflare Pages env vars', {
      missingBinding,
      hasDatabaseUrl: Boolean(resolveBinding(context, 'DATABASE_URL')),
      hasAuthSecret: Boolean(authSecret),
      hasAuthUrl: Boolean(authUrl),
      handlerHasDb: hasD1Binding(handlerEnv),
      workersHasDb: hasD1Binding(workersEnv),
    });
  }

  return betterAuth({
    appName: 'GramSeva Mitra',
    baseURL: authUrl,
    secret: authSecret,
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
      after: rememberMeAfterHook,
    },
  });
}
