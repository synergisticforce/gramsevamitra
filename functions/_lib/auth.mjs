import { env as workersEnv } from 'cloudflare:workers';
import { betterAuth } from 'better-auth';
import { hasD1Binding, readEnvString } from './runtimeEnv.mjs';

/**
 * Resolve a string binding from handler env and/or the Workers module env.
 * @param {import('@gramsevamitra/auth').AuthEnv | Record<string, unknown> | undefined} handlerEnv
 * @param {string} key
 */
function resolveBinding(handlerEnv, key) {
  const fromHandler = readEnvString(handlerEnv, key);
  if (fromHandler) return fromHandler;
  return readEnvString(workersEnv, key);
}

/**
 * Resolve the D1 database binding from handler context env or cloudflare:workers.
 * @param {import('@gramsevamitra/auth').AuthEnv | Record<string, unknown> | undefined} handlerEnv
 */
function resolveDbBinding(handlerEnv) {
  if (hasD1Binding(handlerEnv)) {
    return handlerEnv.DB;
  }
  if (hasD1Binding(workersEnv)) {
    return workersEnv.DB;
  }
  return undefined;
}

/**
 * Runtime Better Auth factory for Cloudflare Pages Functions / Workers.
 * @param {import('@gramsevamitra/auth').AuthEnv | Record<string, unknown> | undefined} handlerEnv
 */
export function createAuth(handlerEnv) {
  const db = resolveDbBinding(handlerEnv);

  if (!db) {
    console.error('[auth] D1 DB binding missing — Better Auth will fall back to MemoryAdapter', {
      handlerHasDb: hasD1Binding(handlerEnv),
      workersHasDb: hasD1Binding(workersEnv),
    });
  }

  return betterAuth({
    appName: 'GramSeva Mitra',
    baseURL: resolveBinding(handlerEnv, 'BETTER_AUTH_URL'),
    secret: resolveBinding(handlerEnv, 'BETTER_AUTH_SECRET'),
    basePath: '/api/auth',
    database: db,
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
    },
    account: {
      modelName: 'accounts',
    },
    verification: {
      modelName: 'verifications',
    },
    socialProviders: {
      google: {
        clientId: resolveBinding(handlerEnv, 'GOOGLE_CLIENT_ID'),
        clientSecret: resolveBinding(handlerEnv, 'GOOGLE_CLIENT_SECRET'),
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
