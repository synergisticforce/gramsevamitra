import { neon } from '@neondatabase/serverless';
import { readEnvString } from './runtimeEnv.mjs';

/** @typedef {import('@neondatabase/serverless').NeonQueryFunction} NeonSql */

/**
 * @param {Record<string, unknown>} env
 * @returns {NeonSql | null}
 */
export function getNeonSql(env) {
  const url = readEnvString(env, 'DATABASE_URL');
  if (!url) return null;
  return neon(url);
}

/**
 * @param {Record<string, unknown>} env
 */
export function hasNeonDatabase(env) {
  return Boolean(readEnvString(env, 'DATABASE_URL'));
}

/**
 * @param {Record<string, unknown>} env
 */
export function hasDatabase(env) {
  const db = env?.DB;
  return hasNeonDatabase(env) || Boolean(db && typeof db.prepare === 'function');
}
