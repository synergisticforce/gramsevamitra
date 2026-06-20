import { readEnvString } from './runtimeEnv.mjs';

/** Verified sandbox sender/recipient when SES_FROM_EMAIL is not set in Cloudflare. */
export const DEFAULT_SES_FROM_EMAIL = 'support@gramsevamitra.com';

/**
 * Resolve SES config from Cloudflare env (SES_REGION, SES_ACCESS_KEY_ID, SES_SECRET_ACCESS_KEY).
 * @param {Record<string, unknown>} env
 */
export function getSesConfig(env) {
  return {
    region: readEnvString(env, 'SES_REGION'),
    accessKeyId: readEnvString(env, 'SES_ACCESS_KEY_ID'),
    secretAccessKey: readEnvString(env, 'SES_SECRET_ACCESS_KEY'),
    fromEmail: readEnvString(env, 'SES_FROM_EMAIL') || DEFAULT_SES_FROM_EMAIL,
  };
}

/**
 * @param {Record<string, unknown>} env
 */
export function getSesConfigDiagnostics(env) {
  const { region, accessKeyId, secretAccessKey, fromEmail } = getSesConfig(env);
  /** @type {string[]} */
  const missing = [];
  if (!region) missing.push('SES_REGION');
  if (!accessKeyId) missing.push('SES_ACCESS_KEY_ID');
  if (!secretAccessKey) missing.push('SES_SECRET_ACCESS_KEY');

  return {
    configured: missing.length === 0,
    region: region || null,
    fromEmail,
    fromEmailSource: readEnvString(env, 'SES_FROM_EMAIL') ? 'SES_FROM_EMAIL' : 'default',
    hasAccessKeyId: Boolean(accessKeyId),
    hasSecretAccessKey: Boolean(secretAccessKey),
    missing,
  };
}

/**
 * Send email via Amazon SES HTTPS API (edge-compatible).
 * Uses SES_REGION, SES_ACCESS_KEY_ID, SES_SECRET_ACCESS_KEY, and optional SES_FROM_EMAIL.
 *
 * @param {{ to: string; subject: string; html: string; text: string; from?: string }} input
 * @param {Record<string, unknown>} env
 */
export async function sendSesAuthEmail(input, env) {
  const { region, accessKeyId, secretAccessKey, fromEmail } = getSesConfig(env);
  const from = input.from || fromEmail;

  if (!region || !accessKeyId || !secretAccessKey) {
    const diagnostics = getSesConfigDiagnostics(env);
    console.warn('[sesMail] SES not configured', diagnostics);
    return { ok: false, skipped: true, reason: 'SES_NOT_CONFIGURED', diagnostics };
  }

  const endpoint = `https://email.${region}.amazonaws.com/`;

  const params = new URLSearchParams({
    Action: 'SendEmail',
    Version: '2010-12-01',
    Source: from,
    'Destination.ToAddresses.member.1': input.to,
    'Message.Subject.Data': input.subject,
    'Message.Subject.Charset': 'UTF-8',
    'Message.Body.Html.Data': input.html,
    'Message.Body.Html.Charset': 'UTF-8',
    'Message.Body.Text.Data': input.text,
    'Message.Body.Text.Charset': 'UTF-8',
  });

  try {
    const { AwsClient } = await import('aws4fetch');
    const aws = new AwsClient({
      accessKeyId,
      secretAccessKey,
      region,
      service: 'ses',
    });

    const response = await aws.fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const body = await response.text();

    if (!response.ok) {
      console.error('[sesMail] SES SendEmail failed', {
        status: response.status,
        region,
        from,
        to: input.to,
        body: body.slice(0, 500),
      });

      const sandbox =
        body.includes('MessageRejected') ||
        body.includes('Email address is not verified') ||
        body.includes('Sandbox');
      if (sandbox) {
        const err = new Error('SES sandbox mode: recipient not verified.');
        err.code = 'SES_SANDBOX_ERROR';
        err.detail = body.slice(0, 500);
        throw err;
      }

      const err = new Error(`SES SendEmail failed (${response.status})`);
      err.detail = body.slice(0, 500);
      throw err;
    }

    const messageIdMatch = body.match(/<MessageId>([^<]+)<\/MessageId>/);
    return {
      ok: true,
      messageId: messageIdMatch?.[1] ?? null,
      region,
      from,
      to: input.to,
    };
  } catch (err) {
    if (err instanceof Error && err.code === 'SES_SANDBOX_ERROR') {
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    if (/sandbox|not verified|MessageRejected/i.test(message)) {
      const sandboxErr = new Error('SES sandbox mode: recipient not verified.');
      sandboxErr.code = 'SES_SANDBOX_ERROR';
      throw sandboxErr;
    }
    throw err;
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ to?: string }} [input]
 */
export async function sendSesTestEmail(env, input = {}) {
  const to = input.to || DEFAULT_SES_FROM_EMAIL;
  const sentAt = new Date().toISOString();

  return sendSesAuthEmail(
    {
      to,
      subject: 'GramSeva Mitra — SES test email',
      text: `This is a test email from GramSeva Mitra via Amazon SES.\n\nSent at: ${sentAt}\nRegion: ${getSesConfig(env).region || 'unknown'}`,
      html: `<p>This is a <strong>test email</strong> from GramSeva Mitra via Amazon SES.</p><p>Sent at: ${sentAt}<br/>Region: ${getSesConfig(env).region || 'unknown'}</p>`,
    },
    env,
  );
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ email: string; url: string }} input
 */
export async function sendMagicLinkEmail(env, input) {
  const subject = 'Sign in to GramSeva Mitra';
  const text = `Click to sign in: ${input.url}\n\nThis link expires soon. If you did not request this, ignore this email.`;
  const html = `<p><a href="${input.url}">Sign in to GramSeva Mitra</a></p><p>This link expires soon.</p>`;
  return sendSesAuthEmail({ to: input.email, subject, html, text }, env);
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ email: string; otp: string }} input
 */
export async function sendEmailOtp(env, input) {
  const subject = 'Your GramSeva Mitra sign-in code';
  const text = `Your verification code is ${input.otp}. It expires in 10 minutes.`;
  const html = `<p>Your verification code is <strong>${input.otp}</strong>.</p><p>It expires in 10 minutes.</p>`;
  const result = await sendSesAuthEmail({ to: input.email, subject, html, text }, env);
  if (!result.ok) {
    if (result.skipped) {
      const err = new Error('Email service is not configured.');
      err.code = 'SES_NOT_CONFIGURED';
      throw err;
    }
    const err = new Error('Could not send verification email.');
    throw err;
  }
  return result;
}
