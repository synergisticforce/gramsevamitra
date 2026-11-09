import { createHash } from 'node:crypto';

/** @type {Map<string, Record<string, string>>} */
const memoryCache = new Map();

const ALIAS_RULES = [
  [/cust payable|net order value|payable \(rs\)/, 'netOrderValuePaise'],
  [/merch settlement|order level payout|order payout|declared payout|settlement amount/, 'declaredOrderPayoutPaise'],
  [/order item id/, 'orderItemId'],
  [/order id|order no/, 'orderId'],
  [/item total|item subtotal|subtotal/, 'itemSubtotalPaise'],
  [/service fee|commission/, 'serviceFeePaise'],
  [/forward shipping|billed weight fee/, 'forwardShippingFeePaise'],
  [/sku/, 'sku'],
];

/**
 * @param {string[]} headers
 */
export async function computeHeaderSignatureHash(headers) {
  const normalized = headers.map((header) => String(header || '').toLowerCase().trim()).sort().join('|');
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * @param {string} header
 */
function aliasFor(header) {
  const name = header.toLowerCase().trim();
  for (const [pattern, field] of ALIAS_RULES) {
    if (pattern.test(name)) return field;
  }
  return '';
}

/**
 * @param {string[]} headers
 * @param {unknown[][]} sampleRows
 * @param {string} geminiKey
 */
async function askGeminiForHeaders(headers, sampleRows, geminiKey) {
  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Map each header to one of: orderId, netOrderValuePaise, declaredOrderPayoutPaise, serviceFeePaise, itemSubtotalPaise, sku. Headers ${JSON.stringify(headers)}. Up to 3 scrubbed sample rows ${JSON.stringify(sampleRows)}. Return only a JSON object.`,
            },
          ],
        },
      ],
    });
    const raw = typeof response.text === 'string' ? response.text : '';
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) return {};
    const parsed = JSON.parse(raw.slice(start, end + 1));
    /** @type {Record<string, string>} */
    const mapping = {};
    for (const header of headers) {
      const field = parsed[header];
      if (typeof field === 'string' && field) mapping[header] = field;
    }
    return mapping;
  } catch {
    return {};
  }
}

/**
 * @param {string[]} headers
 * @param {unknown[][]} sampleRows
 */
function scrubSampleRows(headers, sampleRows) {
  const drop = headers.map((header) => /name|phone|mobile|address|email/i.test(header));
  return sampleRows.slice(0, 3).map((row) => {
    if (!Array.isArray(row)) return row;
    return row.map((cell, index) => (drop[index] ? '' : cell));
  });
}

/**
 * @param {string[]} headers
 * @param {unknown[][]} [sampleRows]
 * @param {{ sql?: { query: Function }, geminiKey?: string }} [options]
 */
export async function mapUnfamiliarSpreadsheetHeaders(headers, sampleRows = [], options = {}) {
  const headerHash = await computeHeaderSignatureHash(headers);
  if (memoryCache.has(headerHash)) {
    return { mapping: memoryCache.get(headerHash), headerHash, cacheHit: true };
  }
  if (options.sql) {
    const rows = await options.sql.query(
      'SELECT mapping_json FROM header_mapping_cache WHERE header_hash = $1 LIMIT 1',
      [headerHash],
    );
    const cached = rows?.[0]?.mapping_json;
    if (cached) {
      const mapping = typeof cached === 'string' ? JSON.parse(cached) : cached;
      memoryCache.set(headerHash, mapping);
      return { mapping, headerHash, cacheHit: true };
    }
  }

  const scrubbed = scrubSampleRows(headers, sampleRows);
  /** @type {Record<string, string>} */
  const mapping = {};
  for (const header of headers) {
    const field = aliasFor(header);
    if (field) mapping[header] = field;
  }
  const unmapped = headers.filter((header) => !mapping[header]);
  if (unmapped.length && options.geminiKey) {
    const learned = await askGeminiForHeaders(unmapped, scrubbed, options.geminiKey);
    Object.assign(mapping, learned);
  }
  memoryCache.set(headerHash, mapping);
  if (options.sql) {
    await options.sql.query(
      `INSERT INTO header_mapping_cache (id, header_hash, platform, mapping_json)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (header_hash) DO NOTHING`,
      [`hdr_${headerHash.slice(0, 12)}`, headerHash, '', JSON.stringify(mapping)],
    );
  }
  return { mapping, headerHash, cacheHit: false };
}
