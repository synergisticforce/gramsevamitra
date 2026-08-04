import { getSesConfigDiagnostics, sendSesAuthEmail } from '../_lib/sesMail.mjs';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const RESEND_API_URL = 'https://api.resend.com/emails';
const CONTACT_TO = 'contact@gramsevamitra.com';
const CONTACT_FROM_RESEND = 'GramSeva Mitra <onboarding@resend.dev>';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function isValidEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function verifyTurnstile(token, secret, remoteIp) {
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

function buildContactBodies({ name, email, subject, message }) {
  const html = `
    <h2>New contact request</h2>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
    <hr />
    <p><strong>Message:</strong></p>
    <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
  `.trim();

  const text = [
    'New contact request',
    `Name: ${name}`,
    `Email: ${email}`,
    `Subject: ${subject}`,
    '',
    message,
  ].join('\n');

  return { html, text };
}

async function sendViaResend({ resendKey, name, email, subject, message }) {
  const { html } = buildContactBodies({ name, email, subject, message });

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: CONTACT_FROM_RESEND,
      to: [CONTACT_TO],
      reply_to: email,
      subject: `New Contact Request: ${subject}`,
      html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Resend API error (${response.status}): ${detail.slice(0, 200)}`);
  }
}

async function sendViaSes(env, { name, email, subject, message }) {
  const { html, text } = buildContactBodies({ name, email, subject, message });
  const result = await sendSesAuthEmail(
    {
      to: CONTACT_TO,
      subject: `New Contact Request: ${subject}`,
      html,
      text: `${text}\n\nReply-To: ${email}`,
    },
    env,
  );

  if (!result.ok) {
    throw new Error(result.reason || 'SES send failed');
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const turnstileSecret = env.TURNSTILE_SECRET_KEY;
  const resendKey = env.RESEND_API_KEY;
  const sesDiagnostics = getSesConfigDiagnostics(env);
  const mailConfigured = sesDiagnostics.configured || Boolean(resendKey);

  if (!mailConfigured) {
    return jsonResponse({ success: false, error: 'Server configuration error.' }, 500);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Invalid JSON payload.' }, 400);
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const email = typeof payload.email === 'string' ? payload.email.trim() : '';
  const subject = typeof payload.subject === 'string' ? payload.subject.trim() : '';
  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  const source = payload.source === 'app' ? 'app' : 'web';
  const turnstileToken =
    typeof payload['cf-turnstile-response'] === 'string'
      ? payload['cf-turnstile-response'].trim()
      : '';

  if (!name || !email || !subject || !message) {
    return jsonResponse({ success: false, error: 'All fields are required.' }, 400);
  }

  if (!isValidEmail(email)) {
    return jsonResponse({ success: false, error: 'Please enter a valid email address.' }, 400);
  }

  if (message.length > 5000) {
    return jsonResponse({ success: false, error: 'Message is too long (max 5000 characters).' }, 400);
  }

  // Web contact page keeps Turnstile; in-app Settings form uses source=app.
  if (source !== 'app') {
    if (!turnstileSecret) {
      return jsonResponse({ success: false, error: 'Server configuration error.' }, 500);
    }
    if (!turnstileToken) {
      return jsonResponse(
        { success: false, error: 'Security verification failed. Please try again.' },
        400,
      );
    }
    const remoteIp = request.headers.get('CF-Connecting-IP') ?? undefined;
    const turnstileOk = await verifyTurnstile(turnstileToken, turnstileSecret, remoteIp);
    if (!turnstileOk) {
      return jsonResponse(
        { success: false, error: 'Security verification failed. Please try again.' },
        403,
      );
    }
  }

  try {
    if (sesDiagnostics.configured) {
      await sendViaSes(env, { name, email, subject, message });
    } else {
      await sendViaResend({ resendKey, name, email, subject, message });
    }

    return jsonResponse({
      success: true,
      message: `Message sent successfully to ${CONTACT_TO}!`,
    });
  } catch (err) {
    console.error('[contact]', err);
    return jsonResponse(
      { success: false, error: 'Unable to send your message. Please try again later.' },
      502,
    );
  }
}

export async function onRequest(context) {
  if (context.request.method === 'POST') {
    return onRequestPost(context);
  }
  return jsonResponse({ success: false, error: 'Method not allowed.' }, 405);
}
