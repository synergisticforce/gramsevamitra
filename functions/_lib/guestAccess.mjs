const COOKIE_NAME = 'gsm_device_id';
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

function readCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (rawKey === name) return rest.join('=');
  }
  return '';
}

/**
 * @param {Request} request
 * @param {string} secret
 */
export async function resolveDeviceCookie(request, secret) {
  const current = readCookie(request, COOKIE_NAME);
  const [id, signature] = current.split('.');
  if (id && signature && secret) {
    const expected = await hmac(secret, id);
    if (expected === signature) return { id, setCookie: '' };
  }

  const nextId = crypto.randomUUID();
  const nextSignature = secret ? await hmac(secret, nextId) : '';
  const token = nextSignature ? `${nextId}.${nextSignature}` : nextId;
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return {
    id: nextId,
    setCookie: `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${secure}`,
  };
}

/**
 * @param {Response} response
 * @param {string} setCookie
 */
export function withSetCookie(response, setCookie) {
  if (!setCookie) return response;
  const headers = new Headers(response.headers);
  headers.append('Set-Cookie', setCookie);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/**
 * @param {Request} request
 */
export async function hashClientIp(request) {
  const forwarded = request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')
    || 'unknown';
  const ip = forwarded.split(',')[0].trim() || 'unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`gsm-guest-ip:${ip}`));
  return bytesToBase64Url(new Uint8Array(digest));
}

export function currentPeriodKey() {
  return new Date().toISOString().slice(0, 7);
}

/**
 * @param {import('@neondatabase/serverless').NeonQueryFunction} sql
 * @param {string} subjectKey
 * @param {string} product
 * @param {number} limit
 */
async function reserveOne(sql, subjectKey, product, limit) {
  const period = currentPeriodKey();
  const rows = await sql`
    INSERT INTO guest_ai_quotas (subject_key, period_key, product, used_count)
    VALUES (${subjectKey}, ${period}, ${product}, 1)
    ON CONFLICT (subject_key, period_key, product)
    DO UPDATE SET used_count = guest_ai_quotas.used_count + 1
    WHERE guest_ai_quotas.used_count < ${limit}
    RETURNING used_count
  `;
  return rows.length ? Number(rows[0].used_count) : null;
}

/**
 * @param {import('@neondatabase/serverless').NeonQueryFunction} sql
 * @param {string[]} subjectKeys
 * @param {string} product
 * @param {number} limit
 */
export async function reserveGuestQuota(sql, subjectKeys, product, limit) {
  /** @type {string[]} */
  const reserved = [];
  for (const subjectKey of subjectKeys) {
    const used = await reserveOne(sql, subjectKey, product, limit);
    if (used === null) {
      await releaseGuestQuota(sql, reserved, product);
      return null;
    }
    reserved.push(subjectKey);
  }
  return reserved;
}

/**
 * @param {import('@neondatabase/serverless').NeonQueryFunction} sql
 * @param {string[]} subjectKeys
 * @param {string} product
 */
export async function releaseGuestQuota(sql, subjectKeys, product) {
  const period = currentPeriodKey();
  for (const subjectKey of subjectKeys) {
    await sql`
      UPDATE guest_ai_quotas
      SET used_count = GREATEST(used_count - 1, 0)
      WHERE subject_key = ${subjectKey} AND period_key = ${period} AND product = ${product}
    `;
  }
}

/**
 * @param {string} token
 * @param {string} secret
 * @param {string} remoteIp
 */
export async function verifyTurnstile(token, secret, remoteIp) {
  if (!secret) return true;
  if (!token) return false;
  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', token);
  if (remoteIp) body.set('remoteip', remoteIp);
  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) return false;
  const result = await response.json();
  return result.success === true;
}
