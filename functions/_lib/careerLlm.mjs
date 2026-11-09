/**
 * Career Prep text generation.
 *
 * English text calls Gemini 3.5 Flash-Lite first, then Sarvam 105B.
 * An Indian language selection, or Indic script in the resume, calls Sarvam 105B first.
 * `sarvam-30b` is not a live Chat Completions model.
 */

import { GoogleGenAI } from '@google/genai';

export const SARVAM_CHAT_MODEL = 'sarvam-105b';
export const GEMINI_CAREER_MODEL = 'gemini-3.5-flash-lite';
export const SARVAM_CHAT_URL = 'https://api.sarvam.ai/v1/chat/completions';

export const CAREER_AI_ACTIONS = new Set([
  'rewrite_resume',
  'generate_cover_letter',
  'interview_coach',
]);

export const MAX_RESUME_TEXT_CHARS = 12_000;
export const MAX_JOB_TEXT_CHARS = 8_000;

/**
 * @param {unknown} raw
 * @param {number} maxChars
 */
export function sanitizeCareerText(raw, maxChars) {
  if (typeof raw !== 'string') return '';
  return raw.replace(/\0/g, '').trim().slice(0, maxChars);
}

/**
 * @param {string} action
 */
export function titleForCareerAction(action) {
  if (action === 'rewrite_resume') return 'AI Resume Rewriter';
  if (action === 'interview_coach') return 'Interview Coach';
  return 'AI Cover Letter';
}

/**
 * @param {string} action
 */
export function filenameForCareerAction(action) {
  if (action === 'rewrite_resume') return 'ai-optimized-resume.txt';
  if (action === 'interview_coach') return 'interview-coach.txt';
  return 'ai-cover-letter.txt';
}

/**
 * @param {string} action
 * @param {string} resumeText
 * @param {string} jobText
 * @param {string} fileName
 */
const INDIC_SCRIPT = /[\u0900-\u0D7F]/u;

/**
 * @param {string} language
 * @param {string} resumeText
 */
export function shouldUseSarvamFirst(language, resumeText) {
  if (typeof language === 'string' && language && language !== 'en') return true;
  return INDIC_SCRIPT.test(resumeText);
}

function buildMessages(action, resumeText, jobText, fileName, language) {
  const system = [
    'You write career documents for job seekers in India and abroad.',
    'Use only facts that appear in the resume text. Do not invent employers, dates, degrees, tools, or metrics.',
    'If a number is not in the source, do not add one.',
    'Write in clear English. Keep Indian language phrases that the candidate already used.',
    'Return plain text only. No preamble and no markdown fences.',
    language && language !== 'en'
      ? `Write the answer in the requested language code: ${language}.`
      : 'Write the answer in English unless the resume itself is in another language.',
  ].join(' ');

  const source = [
    `Source file name: ${fileName || 'resume'}`,
    '',
    'RESUME TEXT:',
    resumeText,
    '',
    jobText ? `JOB DESCRIPTION:\n${jobText}` : 'JOB DESCRIPTION: (not provided)',
  ].join('\n');

  let task = 'Rewrite the resume into ATS-friendly sections with action-verb bullets. Keep every real fact. Mark gaps as [add detail] instead of guessing.';
  if (action === 'generate_cover_letter') {
    task = 'Write a one-page cover letter tailored to the job description. If no job description was provided, write a general letter from the resume only. End with a sign-off and the candidate name if it appears in the resume, otherwise [Your Name].';
  } else if (action === 'interview_coach') {
    task = 'Write 8 interview questions a hiring manager would ask from this resume and job description, each followed by a short answer grounded only in the resume. Label them Question 1 and Answer 1.';
  }

  return [
    { role: 'system', content: system },
    { role: 'user', content: `${task}\n\n${source}` },
  ];
}

/**
 * @param {unknown} content
 */
function textFromMessageContent(content) {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object' && typeof part.text === 'string') return part.text;
      return '';
    })
    .join('')
    .trim();
}

/**
 * @param {string} apiKey
 * @param {Array<{ role: string, content: string }>} messages
 */
async function callSarvam(apiKey, messages) {
  const response = await fetch(SARVAM_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': apiKey,
    },
    body: JSON.stringify({
      model: SARVAM_CHAT_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 1800,
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Sarvam ${response.status}: ${raw.slice(0, 300)}`);
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error('Sarvam returned a non-JSON response.');
  }

  return textFromMessageContent(payload?.choices?.[0]?.message?.content);
}

/**
 * @param {string} apiKey
 * @param {Array<{ role: string, content: string }>} messages
 */
async function callGemini(apiKey, messages) {
  const ai = new GoogleGenAI({ apiKey });
  const system = messages.find((message) => message.role === 'system')?.content ?? '';
  const user = messages.find((message) => message.role === 'user')?.content ?? '';
  const response = await ai.models.generateContent({
    model: GEMINI_CAREER_MODEL,
    contents: [{ role: 'user', parts: [{ text: `${system}\n\n${user}` }] }],
  });
  return typeof response.text === 'string' ? response.text.trim() : '';
}

/**
 * @param {{
 *   sarvamKey: string,
 *   geminiKey: string,
 *   action: string,
 *   resumeText: string,
 *   jobText: string,
 *   fileName: string,
 *   language?: string,
 * }} input
 */
export async function generateCareerText(input) {
  const language = typeof input.language === 'string' ? input.language : 'en';
  const messages = buildMessages(input.action, input.resumeText, input.jobText, input.fileName, language);
  /** @type {string[]} */
  const failures = [];
  const order = shouldUseSarvamFirst(language, input.resumeText)
    ? ['sarvam', 'gemini']
    : ['gemini', 'sarvam'];

  for (const provider of order) {
    if (provider === 'sarvam' && input.sarvamKey) {
      try {
        const text = await callSarvam(input.sarvamKey, messages);
        if (text.length >= 40) {
          return { text, provider: 'sarvam', model: SARVAM_CHAT_MODEL };
        }
        failures.push('Sarvam returned an empty reply');
      } catch (err) {
        failures.push(err instanceof Error ? err.message : 'Sarvam request failed');
      }
    }
    if (provider === 'gemini' && input.geminiKey) {
      try {
        const text = await callGemini(input.geminiKey, messages);
        if (text.length >= 40) {
          return { text, provider: 'gemini', model: GEMINI_CAREER_MODEL };
        }
        failures.push('Gemini returned an empty reply');
      } catch (err) {
        failures.push(err instanceof Error ? err.message : 'Gemini request failed');
      }
    }
  }

  const error = new Error(failures.join(' | ') || 'No career model key is configured.');
  error.code = 'CAREER_UPSTREAM';
  throw error;
}
