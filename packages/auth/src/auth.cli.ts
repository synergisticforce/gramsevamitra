import { DatabaseSync } from 'node:sqlite';
import { betterAuth } from 'better-auth';

const cliDb = new DatabaseSync(':memory:');

/** Minimal config for Better Auth CLI schema generation (Kysely + SQLite). */
export const auth = betterAuth({
  appName: 'GramSeva Mitra',
  baseURL: 'https://gramsevamitra.com',
  secret: 'cli-schema-generation-secret-min-32-chars',
  database: cliDb,
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
      clientId: 'cli-google-client-id',
      clientSecret: 'cli-google-client-secret',
    },
  },
});
