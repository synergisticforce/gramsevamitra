/**
 * Claude (Anthropic) API client — with Prompt Caching enabled.
 *
 * WHAT IS "PROMPT CACHING"? (plain-language explainer)
 * ------------------------------------------------------
 * Every time we call Claude, we send a long "system prompt" — the instructions
 * that tell Claude who it is and how to behave. That system prompt is almost
 * always the SAME text on every request, only the user's actual question changes.
 *
 * Normally, Claude has to re-read that entire system prompt from scratch, every
 * single time, and we pay full price for those tokens — even though nothing
 * about the instructions changed.
 *
 * Prompt Caching lets us tell Claude: "Remember this system prompt for a while,
 * like a sticky note on your desk." The next time we send the same system
 * prompt, Claude recognizes it and reuses its "memory" of it instead of
 * re-reading it — which is roughly 90% cheaper and noticeably faster.
 *
 * This file does two things:
 *   1. Defines the system prompts we reuse often (so they only live in one place).
 *   2. Sends them to Claude with the special "cache_control" flag attached, which
 *      is the "sticky note" instruction described above.
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// Anthropic requires this header on every request. It is not a secret — it just
// tells the API which version of the API "shape" we are speaking.
const ANTHROPIC_API_VERSION = '2023-06-01';

// Dateless, pinned model ID for Claude Sonnet 5 — Anthropic's current
// "best balance of speed and intelligence" model. Update this constant if
// Anthropic ships a newer default model later.
export const CLAUDE_MODEL = 'claude-sonnet-5';

// How long Claude should keep the cached system prompt "on its desk" before it
// has to be re-read in full again. '5m' (default if omitted) is the cheapest
// option, but our system prompts are reused constantly across many users
// throughout the day, so the longer '1h' option keeps the cache "warm" and
// saves more money overall (it costs a little more per write, but pays for
// itself quickly when reused many times within the hour).
const DEFAULT_CACHE_TTL = '1h';

/**
 * A reusable system prompt for GramSevaMitra's "explain this document / chart"
 * assistant persona. Kept intentionally detailed (long enough to be worth
 * caching — Claude Sonnet models only start caching once a system prompt is
 * at least ~1,024 tokens long) so it is genuinely useful on every call, not
 * just padding for the sake of caching.
 */
export const DOCUMENT_INSIGHT_SYSTEM_PROMPT = `You are the GramSevaMitra Document & Finance Explainer, a calm and patient assistant built for everyday users in India — including students, gig workers, small shop owners, and rural residents who may not be fluent in financial or legal jargon and may be reading English as a second or third language.

YOUR JOB
Explain documents, bills, bank statements, invoices, payslips, government forms, tax notices, and financial charts in plain, simple language. Assume the reader has no background in finance, accounting, or law unless they say otherwise. Never assume the reader already understands technical terms like "TDS", "amortization", "GST input credit", or "YoY growth" — define them briefly, in one short sentence, the first time you use them.

TONE AND STYLE
- Warm, respectful, and encouraging — never condescending, never robotic.
- Use short sentences and short paragraphs. Prefer bullet points over dense prose when listing more than two items.
- Where helpful, use a simple real-world comparison (for example, comparing compound interest to a snowball rolling downhill) to make an abstract idea concrete.
- Avoid unnecessary hedging ("it might possibly be the case that..."). State things plainly, and note uncertainty only when it genuinely matters (for example, when a number in the document is unclear or the document is incomplete).
- Reply in the same language the user's question was asked in when possible. If the source document is in Hindi, Bengali, or another Indian regional language and the user asks in English, translate the key figures and terms into English as part of the explanation.

WHAT TO COVER FOR EACH DOCUMENT TYPE
- Invoices and bills: total amount due, due date, what each line item means, and any late fees or taxes included.
- Bank statements: opening/closing balance, unusual or large transactions worth double-checking, and any recurring charges.
- Payslips: gross pay, net pay, and a one-line explanation of each deduction (PF, ESI, professional tax, TDS, etc.).
- Charts and graphs: what the axes represent, the overall trend in one sentence, and the single most important takeaway a busy reader should remember.
- Government or legal forms: what the form is for, any deadline mentioned, and what happens if the reader does nothing.

SAFETY AND HONESTY RULES
- Never invent numbers, dates, or clauses that are not actually present in the document. If something is unreadable or missing, say so plainly instead of guessing.
- You are not a licensed financial advisor, tax preparer, or lawyer. For anything involving legal risk, large financial decisions, or tax filing, add a brief, friendly reminder to double-check with a qualified professional before acting — but do not let this reminder dominate the response.
- Do not share, repeat back, or store any sensitive personal identifiers (full bank account numbers, Aadhaar numbers, PAN numbers, passwords) beyond what is strictly needed to answer the question. Mask long ID numbers when quoting them back (e.g., "account ending in 4821").
- If a document appears to be a scam, phishing attempt, or fraudulent notice, say so clearly and explain the warning signs in simple terms.

FORMATTING RULES
- Lead with a one- or two-sentence plain-language summary before any details.
- Use bold only for the single most important number or deadline in the response.
- Keep the entire response focused and skimmable — most answers should fit comfortably on one screen without scrolling excessively.`;

/**
 * Wraps a system prompt string in the shape Claude expects when you want
 * caching enabled. Claude only allows caching when "system" is sent as an
 * array of blocks (not a plain string), with a "cache_control" flag attached
 * to the block you want remembered. Think of this as putting a sticky note
 * that says "keep this one warm" on top of the instructions.
 *
 * @param {string} promptText The system prompt to send and cache.
 * @param {{ ttl?: '5m' | '1h' }} [options]
 */
export function buildCachedSystemPrompt(promptText, options = {}) {
  const ttl = options.ttl || DEFAULT_CACHE_TTL;
  return [
    {
      type: 'text',
      text: promptText,
      // This is the actual "cache this" instruction. "ephemeral" is the only
      // cache type Claude currently offers — it just means "temporary sticky
      // note", as opposed to something stored forever.
      cache_control: { type: 'ephemeral', ttl },
    },
  ];
}

/**
 * Sends a question to Claude, reusing (and caching) a shared system prompt.
 *
 * @param {{
 *   apiKey: string;
 *   systemPrompt: string;
 *   userMessage: string;
 *   model?: string;
 *   maxTokens?: number;
 *   cacheTtl?: '5m' | '1h';
 * }} input
 */
export async function askClaudeWithCachedSystemPrompt(input) {
  const {
    apiKey,
    systemPrompt,
    userMessage,
    model = CLAUDE_MODEL,
    maxTokens = 1024,
    cacheTtl = DEFAULT_CACHE_TTL,
  } = input;

  if (!apiKey) {
    const err = new Error('ANTHROPIC_API_KEY is not configured.');
    err.code = 'CONFIG';
    throw err;
  }

  if (!userMessage || typeof userMessage !== 'string') {
    const err = new Error('A userMessage is required.');
    err.code = 'BAD_PAYLOAD';
    throw err;
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      // These three headers are all Claude needs. No special "beta" caching
      // header is required anymore — caching is a normal, always-on feature.
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_API_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      // The cached "sticky note" instructions live here.
      system: buildCachedSystemPrompt(systemPrompt, { ttl: cacheTtl }),
      // The part that changes on every request — never cached.
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    const err = new Error(`Claude API error (${response.status}): ${errorBody || response.statusText}`);
    err.code = response.status === 401 || response.status === 403 ? 'API_KEY' : 'CLAUDE';
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const text = Array.isArray(data.content)
    ? data.content
        .filter((block) => block && block.type === 'text')
        .map((block) => block.text)
        .join('\n')
    : '';

  const usage = data.usage || {};
  return {
    text,
    model: data.model || model,
    usage: {
      inputTokens: usage.input_tokens ?? 0,
      outputTokens: usage.output_tokens ?? 0,
      // Tokens that were WRITTEN to the cache on this call (first time seeing
      // this system prompt, or the previous cache had expired).
      cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
      // Tokens that were READ from the cache — these are the ones billed at
      // roughly 90% off, because Claude didn't have to re-process them.
      cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
    },
  };
}

/**
 * Turns Claude's usage numbers into a one-line, non-technical summary — handy
 * for logs or an admin dashboard so anyone can see caching is actually saving
 * money, without needing to understand token pricing.
 *
 * @param {{ inputTokens: number; cacheReadInputTokens: number; cacheCreationInputTokens: number }} usage
 */
export function describeCacheSavings(usage) {
  const { cacheReadInputTokens = 0, cacheCreationInputTokens = 0 } = usage || {};

  if (cacheReadInputTokens > 0) {
    return `Reused ${cacheReadInputTokens.toLocaleString()} cached tokens from the system prompt instead of reprocessing them (about 90% cheaper than a normal request).`;
  }

  if (cacheCreationInputTokens > 0) {
    return `Stored ${cacheCreationInputTokens.toLocaleString()} tokens of the system prompt in Claude's cache for the next request to reuse.`;
  }

  return 'No cache activity — the system prompt may be too short to cache (Claude requires roughly 1,024+ tokens).';
}
