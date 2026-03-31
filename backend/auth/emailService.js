import dotenv from "dotenv";
dotenv.config();
import nodemailer from "nodemailer";
import { Resend } from "resend";

function getEmailFromAddress() {
  return process.env.EMAIL_FROM || '"LegalAId" <noreply@legalaid.in>';
}

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

function resolveFallbackTransportConfig() {
  if (process.env.SMTP_HOST && process.env.SMTP_PASS) {
    const port = Number(process.env.SMTP_PORT || 587);
    return {
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465 || port === 2465,
      auth: {
        user: process.env.SMTP_USER || "",
        pass: process.env.SMTP_PASS,
      },
    };
  }

  if (process.env.MAILTRAP_USER && process.env.MAILTRAP_PASS) {
    return {
      host: process.env.MAILTRAP_HOST || "sandbox.smtp.mailtrap.io",
      port: Number(process.env.MAILTRAP_PORT || 2525),
      secure: false,
      auth: {
        user: process.env.MAILTRAP_USER,
        pass: process.env.MAILTRAP_PASS,
      },
    };
  }

  throw new Error(
    "No email transport configured. Set RESEND_API_KEY for Resend SDK, or configure SMTP_/MAILTRAP_ fallback credentials."
  );
}

function createTransporter() {
  return nodemailer.createTransport(resolveFallbackTransportConfig());
}

function isRetryableMailError(error) {
  const message = `${error?.response || ""} ${error?.message || ""}`.trim();
  const statusCode = Number(error?.statusCode || 0);
  return /too many emails per second|rate limit|too many requests|429/i.test(
    message
  ) || statusCode === 429 || statusCode >= 500;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeEmailPayload(mailOptions) {
  return {
    from: mailOptions.from,
    to: mailOptions.to,
    subject: mailOptions.subject,
    html: mailOptions.html,
    text: mailOptions.text,
    cc: mailOptions.cc,
    bcc: mailOptions.bcc,
    reply_to: mailOptions.reply_to,
    headers: mailOptions.headers,
    tags: mailOptions.tags,
  };
}

async function sendViaResend(mailOptions, { idempotencyKey } = {}) {
  const { data, error } = await resend.emails.send(
    normalizeEmailPayload(mailOptions),
    idempotencyKey ? { idempotencyKey } : undefined
  );

  if (error) {
    const resendError = new Error(error.message || "Resend email send failed.");
    resendError.name = error.name || "resend_error";
    resendError.statusCode = error.statusCode ?? null;
    throw resendError;
  }

  return data;
}

async function sendViaFallbackSmtp(mailOptions) {
  const { tags, ...smtpMailOptions } = mailOptions;
  return createTransporter().sendMail(smtpMailOptions);
}

async function sendMailWithRetry(
  mailOptions,
  { attempts = 3, idempotencyKey } = {}
) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      if (resend) {
        return await sendViaResend(mailOptions, { idempotencyKey });
      }

      return await sendViaFallbackSmtp(mailOptions);
    } catch (error) {
      lastError = error;
      if (attempt === attempts || !isRetryableMailError(error)) {
        throw error;
      }

      // SMTP providers can briefly throttle back-to-back auth emails.
      await sleep(1200 * attempt);
    }
  }

  throw lastError;
}

const YEAR = new Date().getFullYear();

const emailShell = (content) => `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#faf9f7;border:1px solid #e8e5de;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(13,13,18,0.08);">
        <tr>
          <td style="background:#0d0d12;padding:24px 40px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:10px;">
                  <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 4h10l6 6v18H8V4z" stroke="#c4922a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M18 4v6h6" stroke="#c4922a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <circle cx="16" cy="19" r="5" stroke="#c4922a" stroke-width="1.5"/>
                    <polyline points="13.5,19 15,20.5 18.5,17" stroke="#c4922a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </td>
                <td>
                  <p style="margin:0;font-family:Georgia,serif;font-size:20px;font-weight:700;color:#fff;letter-spacing:-0.3px;">
                    Legal<span style="color:#c4922a;font-style:italic;">AI</span>d
                  </p>
                  <p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.3);letter-spacing:1.5px;text-transform:uppercase;">
                    Indian Legal Document Engine
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        ${content}
        <tr>
          <td style="padding:16px 40px;border-top:1px solid #e8e5de;background:#faf9f7;">
            <p style="margin:0;font-size:11px;color:#a8a8bc;text-align:center;">
              © ${YEAR} LegalAId · AI-drafted, IRE-validated Indian legal documents<br/>
              <span style="font-size:10px;">Do not reply to this email. This is an automated message.</span>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

// ── Send verification email ────────────────────────────────────────────────────
export async function sendVerificationEmail(name, email, token) {
  const url = `${
    process.env.CLIENT_URL
  }/verify-email?token=${encodeURIComponent(token)}`;

  await sendMailWithRetry({
    from: getEmailFromAddress(),
    to: email,
    subject: "Verify your LegalAId account",
    tags: [
      { name: "flow", value: "verification" },
      { name: "product", value: "legalaid" },
    ],
    html: emailShell(`
      <tr>
        <td style="padding:40px 40px 32px;">
          <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:24px;font-weight:700;color:#0d0d12;letter-spacing:-0.3px;">
            Verify your email
          </h1>
          <p style="margin:0 0 28px;font-size:15px;color:#3a3a4a;line-height:1.65;">
            Hi <strong>${name}</strong>, welcome to LegalAId. Click the button below to verify your email address and start generating legally sound Indian documents.
          </p>
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="border-radius:10px;background:#0d0d12;">
                <a href="${url}" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:600;color:#fff;text-decoration:none;letter-spacing:0.2px;">
                  Verify Email Address →
                </a>
              </td>
            </tr>
          </table>
          <p style="margin:24px 0 0;font-size:13px;color:#a8a8bc;line-height:1.5;">
            This link expires in <strong>24 hours</strong>. If you didn't create a LegalAId account, you can safely ignore this email.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 40px 28px;">
          <p style="margin:0;font-size:11.5px;color:#a8a8bc;">
            Button not working? Copy this link:<br/>
            <a href="${url}" style="color:#c4922a;word-break:break-all;font-size:11px;">${url}</a>
          </p>
        </td>
      </tr>
    `),
  }, { idempotencyKey: `verify:${token}` });
}

// ── Send password reset email ──────────────────────────────────────────────────
export async function sendPasswordResetEmail(name, email, token) {
  const url = `${
    process.env.CLIENT_URL
  }/reset-password?token=${encodeURIComponent(token)}`;

  await sendMailWithRetry({
    from: getEmailFromAddress(),
    to: email,
    subject: "Reset your LegalAId password",
    tags: [
      { name: "flow", value: "password_reset" },
      { name: "product", value: "legalaid" },
    ],
    html: emailShell(`
      <tr>
        <td style="padding:40px 40px 32px;">
          <div style="width:48px;height:48px;border-radius:12px;background:#fdf7e8;border:1px solid #f0d98a;display:flex;align-items:center;justify-content:center;margin-bottom:20px;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#92600a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="7.5" cy="15.5" r="5.5"/>
              <path d="M21 2l-9.6 9.6"/>
              <path d="M15.5 7.5l3 3L22 7l-3-3"/>
            </svg>
          </div>
          <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:24px;font-weight:700;color:#0d0d12;letter-spacing:-0.3px;">
            Reset your password
          </h1>
          <p style="margin:0 0 28px;font-size:15px;color:#3a3a4a;line-height:1.65;">
            Hi <strong>${name}</strong>, we received a request to reset your LegalAId password. Click the button below to create a new password.
          </p>
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="border-radius:10px;background:#c4922a;">
                <a href="${url}" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:600;color:#fff;text-decoration:none;letter-spacing:0.2px;">
                  Reset Password →
                </a>
              </td>
            </tr>
          </table>
          <p style="margin:24px 0 0;font-size:13px;color:#a8a8bc;line-height:1.5;">
            This link expires in <strong>1 hour</strong>. If you didn't request a password reset, please ignore this email — your password will remain unchanged.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 40px 28px;">
          <p style="margin:0;font-size:11.5px;color:#a8a8bc;">
            Button not working? Copy this link:<br/>
            <a href="${url}" style="color:#c4922a;word-break:break-all;font-size:11px;">${url}</a>
          </p>
        </td>
      </tr>
    `),
  }, { idempotencyKey: `reset:${token}` });
}
