import { readEnvString } from './runtimeEnv.mjs';

/**
 * Send auth email via Amazon SES HTTPS API (edge-compatible; SMTP credentials map to IAM).
 * Returns { ok: true } or throws with code SES_SANDBOX_ERROR for sandbox rejections.
 *
 * @param {{ to: string; subject: string; html: string; text: string }} input
 * @param {Record<string, unknown>} env
 */
export async function sendSesAuthEmail(input, env) {
  const region = readEnvString(env, 'SES_REGION') || readEnvString(env, 'AWS_REGION') || 'ap-south-1';
  const accessKey = readEnvString(env, 'SES_ACCESS_KEY_ID') || readEnvString(env, 'AWS_ACCESS_KEY_ID');
  const secretKey = readEnvString(env, 'SES_SECRET_ACCESS_KEY') || readEnvString(env, 'AWS_SECRET_ACCESS_KEY');
  const from = readEnvString(env, 'SES_FROM_EMAIL');

  if (!from || !accessKey || !secretKey) {
    console.warn('[sesMail] SES credentials not configured — email not sent');
    return { ok: false, skipped: true };
  }

  const endpoint = `https://email.${region}.amazonaws.com/`;

  const params = new URLSearchParams({
    Action: 'SendEmail',
    Version: '2010-12-01',
    Source: from,
    'Destination.ToAddresses.member.1': input.to,
    'Message.Subject.Data': input.subject,
    'Message.Body.Html.Data': input.html,
    'Message.Body.Text.Data': input.text,
  });

  try {
    const { AwsClient } = await import('aws4fetch');
    const aws = new AwsClient({ accessKeyId: accessKey, secretAccessKey: secretKey, region });
    const response = await aws.fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const body = await response.text();

    if (!response.ok) {
      const sandbox =
        body.includes('MessageRejected') ||
        body.includes('Email address is not verified') ||
        body.includes('Sandbox');
      if (sandbox) {
        const err = new Error('SES sandbox mode: recipient not verified.');
        err.code = 'SES_SANDBOX_ERROR';
        throw err;
      }
      throw new Error(`SES SendEmail failed (${response.status})`);
    }

    return { ok: true };
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
  return sendSesAuthEmail({ to: input.email, subject, html, text }, env);
}
