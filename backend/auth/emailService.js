import dotenv from "dotenv";
dotenv.config();

import nodemailer from "nodemailer";

// Mailtrap SMTP transporter
function createTransporter() {
  return nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    auth: {
      user: process.env.MAILTRAP_USER,
      pass: process.env.MAILTRAP_PASS,
    },
  });
}

export async function sendVerificationEmail(name, email, token) {
  const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${encodeURIComponent(token)}`;
  const transporter = createTransporter();

  await transporter.sendMail({
    from: '"LegalAId" <noreply@legalaid.in>',
    to: email,
    subject: "Verify your LegalAId account",
    html: `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background:#f4f2ee;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
          <tr><td align="center">
            <table width="560" cellpadding="0" cellspacing="0" style="background:#faf9f7;border:1px solid #e8e4dc;border-radius:16px;overflow:hidden;">

              <tr>
                <td style="background:#0a0a0f;padding:28px 40px;">
                  <p style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;">
                    Legal<span style="color:#b5893a;">AI</span>d
                  </p>
                  <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.3);letter-spacing:1px;text-transform:uppercase;">
                    Indian Legal Document Engine
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding:40px 40px 32px;">
                  <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:26px;font-weight:700;color:#0a0a0f;">
                    Verify your email
                  </h1>
                  <p style="margin:0 0 24px;font-size:15px;color:#3d3d4f;line-height:1.6;">
                    Hi ${name}, welcome to LegalAId. Click the button below to verify your email address and start generating legally sound Indian documents.
                  </p>
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="border-radius:8px;background:#0a0a0f;">
                        <a href="${verificationUrl}" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:600;color:#fff;text-decoration:none;">
                          Verify Email Address →
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:24px 0 0;font-size:13px;color:#b0adb8;line-height:1.5;">
                    This link expires in <strong>24 hours</strong>. If you didn't create a LegalAId account, ignore this email.
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding:0 40px 32px;">
                  <p style="margin:0;font-size:12px;color:#b0adb8;">
                    If the button doesn't work, copy this link:<br/>
                    <a href="${verificationUrl}" style="color:#b5893a;word-break:break-all;">${verificationUrl}</a>
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding:20px 40px;border-top:1px solid #e8e4dc;">
                  <p style="margin:0;font-size:11px;color:#b0adb8;text-align:center;">
                    © ${new Date().getFullYear()} LegalAId · Powered by IndiaCode + IRE
                  </p>
                </td>
              </tr>

            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `,
  });
}