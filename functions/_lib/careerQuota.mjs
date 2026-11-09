/** Monthly free Career Prep generations. Pro accounts skip this cap. */

export const FREE_CAREER_GENERATIONS_PER_MONTH = 3;

/** @type {Promise<void> | null} */
let tableReady = null;

/**
 * @param {import('@neondatabase/serverless').NeonQueryFunction} sql
 */
export function ensureCareerUsageTable(sql) {
  if (!tableReady) {
    tableReady = sql`
      CREATE TABLE IF NOT EXISTS career_ai_usage (
        subject_key TEXT NOT NULL,
        period_key TEXT NOT NULL,
        used_count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (subject_key, period_key)
      )
    `
      .then(() => undefined)
      .catch((err) => {
        tableReady = null;
        throw err;
      });
  }
  return tableReady;
}

export function currentPeriodKey() {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Reserve one free generation. Returns the new count, or null when the month is full.
 * @param {import('@neondatabase/serverless').NeonQueryFunction} sql
 * @param {string} subjectKey
 */
export async function reserveFreeGeneration(sql, subjectKey) {
  await ensureCareerUsageTable(sql);
  const period = currentPeriodKey();
  const rows = await sql`
    INSERT INTO career_ai_usage (subject_key, period_key, used_count)
    VALUES (${subjectKey}, ${period}, 1)
    ON CONFLICT (subject_key, period_key)
    DO UPDATE SET used_count = career_ai_usage.used_count + 1
    WHERE career_ai_usage.used_count < ${FREE_CAREER_GENERATIONS_PER_MONTH}
    RETURNING used_count
  `;
  if (!rows.length) return null;
  return Number(rows[0].used_count);
}

/**
 * Give a reserved free generation back after an upstream failure.
 * @param {import('@neondatabase/serverless').NeonQueryFunction} sql
 * @param {string} subjectKey
 */
export async function releaseFreeGeneration(sql, subjectKey) {
  const period = currentPeriodKey();
  await sql`
    UPDATE career_ai_usage
    SET used_count = GREATEST(used_count - 1, 0)
    WHERE subject_key = ${subjectKey} AND period_key = ${period}
  `;
}

/**
 * @param {Request} request
 */
export async function guestSubjectKey(request) {
  const forwarded = request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')
    || 'unknown';
  const ip = forwarded.split(',')[0].trim() || 'unknown';
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`gramseva-career-guest:${ip}`),
  );
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `guest:${hex}`;
}
