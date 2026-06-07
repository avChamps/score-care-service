const nodemailer = require("nodemailer");

const env = require("../config/env");

function createTransporter() {
  return nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: {
      user: env.smtp.user,
      pass: env.smtp.password
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildWelcomeEmail(user) {
  const fullName = escapeHtml(user.fullName || "there");
  const mobileNumber = escapeHtml(user.mobileNumber);
  const panNumber = escapeHtml(user.panNumber);

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Welcome to ScoreCare</title>
      </head>
      <body style="margin:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#172033;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 18px 50px rgba(23,32,51,0.12);">
                <tr>
                  <td style="background:#071629;padding:34px 32px;color:#ffffff;">
                    <div style="font-size:14px;letter-spacing:1.6px;text-transform:uppercase;color:#7dd3fc;font-weight:700;">ScoreCare</div>
                    <h1 style="margin:14px 0 0;font-size:30px;line-height:1.2;font-weight:800;">Welcome to your credit care dashboard</h1>
                    <p style="margin:14px 0 0;color:#d8e7f7;font-size:16px;line-height:1.6;">Your profile is ready. We are glad to have you with ScoreCare.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px;">
                    <p style="margin:0 0 18px;font-size:18px;line-height:1.6;">Hi ${fullName},</p>
                    <p style="margin:0 0 22px;font-size:16px;line-height:1.7;color:#435269;">Thank you for completing your ScoreCare profile. You can now continue using ScoreCare services from your dashboard.</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e5edf6;border-radius:14px;margin:24px 0;">
                      <tr>
                        <td style="padding:18px 20px;border-bottom:1px solid #e5edf6;color:#64748b;font-size:13px;text-transform:uppercase;letter-spacing:.8px;">Mobile</td>
                        <td align="right" style="padding:18px 20px;border-bottom:1px solid #e5edf6;font-weight:700;color:#172033;">${mobileNumber}</td>
                      </tr>
                      <tr>
                        <td style="padding:18px 20px;color:#64748b;font-size:13px;text-transform:uppercase;letter-spacing:.8px;">PAN</td>
                        <td align="right" style="padding:18px 20px;font-weight:700;color:#172033;">${panNumber}</td>
                      </tr>
                    </table>
                    <p style="margin:22px 0 0;font-size:14px;line-height:1.6;color:#64748b;">This welcome email is sent only once after your first profile completion.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:22px 32px;background:#eef4fb;color:#64748b;font-size:13px;line-height:1.6;">
                    ScoreCare helps you stay informed and in control of your credit journey.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

async function sendWelcomeEmail(user) {
  if (!user.email) {
    return {
      status: "skipped",
      reason: "User email is not available"
    };
  }

  if (!env.smtp.user || !env.smtp.password) {
    return {
      status: "skipped",
      reason: "SMTP credentials are not configured"
    };
  }

  try {
    const transporter = createTransporter();
    const body = buildWelcomeEmail(user);

    await transporter.sendMail({
      from: `"${env.smtp.fromName}" <${env.smtp.user}>`,
      to: user.email,
      subject: "Welcome to ScoreCare",
      text: `Hi ${user.fullName || "there"}, welcome to ScoreCare. Your profile has been completed successfully.`,
      html: body
    });

    return {
      status: "sent",
      to: user.email
    };
  } catch (error) {
    return {
      status: "failed",
      reason: error.message
    };
  }
}

module.exports = {
  sendWelcomeEmail
};
