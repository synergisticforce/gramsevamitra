import { GoogleGenAI } from '@google/genai';

const GEMINI_MODELS = ['gemini-3.5-flash-lite', 'gemini-2.5-flash-lite'];
const SARVAM_PARSE_URL = 'https://api.sarvam.ai/doc-ai/v1/job/parse';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {string} raw
 */
function parseModelJson(raw) {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const payload = JSON.parse(trimmed.slice(start, end + 1));
    const rows = Array.isArray(payload.rows)
      ? payload.rows
          .filter((row) => Array.isArray(row))
          .map((row) => row.map((cell) => String(cell ?? '')))
      : [];
    const text = typeof payload.text === 'string' ? payload.text.trim() : '';
    if (!rows.length && !text) return null;
    return { rows, text };
  } catch {
    return null;
  }
}

/**
 * @param {string} apiKey
 * @param {string} model
 * @param {string} mimeType
 * @param {Uint8Array} bytes
 */
async function callGemini(apiKey, model, mimeType, bytes) {
  const ai = new GoogleGenAI({ apiKey });
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: 'Extract this document. Return only JSON with keys rows (array of string arrays, one row per table or line) and text (plain reading order). Do not invent numbers.',
          },
          { inlineData: { mimeType, data: btoa(binary) } },
        ],
      },
    ],
  });
  const text = typeof response.text === 'string' ? response.text : '';
  return parseModelJson(text);
}

/**
 * @param {string} endpoint
 * @param {string} key
 * @param {Uint8Array} bytes
 * @param {string} mimeType
 */
async function callAzure(endpoint, key, bytes, mimeType) {
  const root = endpoint.replace(/\/$/, '');
  const start = await fetch(
    `${root}/documentintelligence/documentModels/prebuilt-layout:analyze?api-version=2024-11-30&pages=1-2`,
    {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': mimeType,
      },
      body: bytes,
    },
  );
  if (start.status !== 202) {
    throw new Error(`Azure Document Intelligence returned ${start.status}`);
  }
  const operation = start.headers.get('operation-location');
  if (!operation) throw new Error('Azure did not return an operation URL.');

  for (let attempt = 0; attempt < 8; attempt += 1) {
    await sleep(1500);
    const poll = await fetch(operation, { headers: { 'Ocp-Apim-Subscription-Key': key } });
    const payload = await poll.json();
    if (payload.status === 'succeeded') {
      const tables = payload.analyzeResult?.tables ?? [];
      if (tables.length) {
        const rows = [];
        for (const table of tables) {
          const grid = [];
          for (const cell of table.cells ?? []) {
            const rowIndex = Number(cell.rowIndex) || 0;
            const columnIndex = Number(cell.columnIndex) || 0;
            if (!grid[rowIndex]) grid[rowIndex] = [];
            grid[rowIndex][columnIndex] = String(cell.content ?? '');
          }
          for (const row of grid) {
            if (row) rows.push(row.map((cell) => cell ?? ''));
          }
        }
        const text = (payload.analyzeResult?.content || '').slice(0, 20000);
        return { rows, text, provider: 'azure' };
      }
      const text = String(payload.analyzeResult?.content || '').trim();
      if (!text) return null;
      return {
        rows: text.split(/\n+/).filter(Boolean).map((line) => [line]),
        text,
        provider: 'azure',
      };
    }
    if (payload.status === 'failed') throw new Error('Azure Document Intelligence failed.');
  }
  throw new Error('Azure Document Intelligence timed out.');
}

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzipText(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  let offset = 0;
  /** @type {string[]} */
  const texts = [];
  while (offset + 30 <= bytes.length) {
    if (view.getUint32(offset, true) !== 0x04034b50) break;
    const flags = view.getUint16(offset + 6, true);
    const method = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength));
    const dataStart = nameStart + nameLength + extraLength;
    if (flags & 0x08) break;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) break;
    if (/\.(md|html|txt|json)$/i.test(name)) {
      const slice = bytes.subarray(dataStart, dataEnd);
      const raw = method === 8 ? await inflate(slice) : method === 0 ? slice : null;
      if (raw) texts.push(decoder.decode(raw));
    }
    offset = dataEnd;
  }
  return texts.join('\n');
}

/**
 * @param {string} apiKey
 * @param {Uint8Array} bytes
 * @param {string} fileName
 * @param {string} mimeType
 * @param {string} language
 */
async function callSarvam(apiKey, bytes, fileName, mimeType, language) {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: mimeType }), fileName || 'document.pdf');
  const languageCode = language.includes('-') ? language : language === 'en' ? 'en-IN' : `${language}-IN`;
  form.append('language', languageCode);
  form.append('output_format', 'md');
  const created = await fetch(SARVAM_PARSE_URL, {
    method: 'POST',
    headers: { 'api-subscription-key': apiKey },
    body: form,
  });
  if (!created.ok) throw new Error(`Sarvam Vision returned ${created.status}`);
  const job = await created.json();
  const jobId = job.job_id;
  if (!jobId) throw new Error('Sarvam Vision did not return a job id.');

  for (let attempt = 0; attempt < 8; attempt += 1) {
    await sleep(1500);
    const statusResponse = await fetch(`https://api.sarvam.ai/doc-ai/v1/job/${jobId}/status`, {
      headers: { 'api-subscription-key': apiKey },
    });
    const status = await statusResponse.json();
    if (status.status === 'failed' || status.status === 'rejected') {
      throw new Error('Sarvam Vision could not read this file.');
    }
    if (status.status !== 'completed' && status.status !== 'partially_completed') continue;
    const linkResponse = await fetch(`https://api.sarvam.ai/doc-ai/v1/job/${jobId}/download-url`, {
      headers: { 'api-subscription-key': apiKey },
    });
    const link = await linkResponse.json();
    if (!link.url) throw new Error('Sarvam Vision did not return a download.');
    const fileResponse = await fetch(link.url);
    const packed = new Uint8Array(await fileResponse.arrayBuffer());
    const extracted = (await unzipText(packed)) || new TextDecoder().decode(packed);
    const text = extracted.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text) return null;
    return {
      rows: extracted.split(/\n+/).map((line) => line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())).filter((row) => row.some(Boolean) && !row.every((cell) => /^-+$/.test(cell))),
      text,
      provider: 'sarvam-vision',
    };
  }
  throw new Error('Sarvam Vision timed out.');
}

/**
 * @param {{
 *   bytes: Uint8Array,
 *   mimeType: string,
 *   fileName: string,
 *   language: string,
 *   azureEndpoint: string,
 *   azureKey: string,
 *   sarvamKey: string,
 *   geminiKey: string,
 * }} input
 */
export async function convertDocumentWithCloud(input) {
  /** @type {string[]} */
  const failures = [];
  const indic = input.language && input.language !== 'en';
  const steps = indic
    ? ['sarvam', 'gemini', 'azure']
    : ['azure', 'sarvam', 'gemini'];

  for (const step of steps) {
    try {
      if (step === 'azure' && input.azureEndpoint && input.azureKey) {
        const result = await callAzure(input.azureEndpoint, input.azureKey, input.bytes, input.mimeType);
        if (result) return result;
      }
      if (step === 'sarvam' && input.sarvamKey) {
        const result = await callSarvam(input.sarvamKey, input.bytes, input.fileName, input.mimeType, input.language || 'en');
        if (result) return result;
      }
      if (step === 'gemini' && input.geminiKey) {
        for (const model of GEMINI_MODELS) {
          try {
            const result = await callGemini(input.geminiKey, model, input.mimeType, input.bytes);
            if (result) return { ...result, provider: model };
          } catch (err) {
            failures.push(err instanceof Error ? err.message : `${model} failed`);
          }
        }
      }
    } catch (err) {
      failures.push(err instanceof Error ? err.message : `${step} failed`);
    }
  }

  const error = new Error(failures.join(' | ') || 'No document reader is configured.');
  error.code = 'DOCUMENT_CLOUD';
  throw error;
}
