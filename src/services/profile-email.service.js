const nodemailer = require("nodemailer");
const path = require("path");

const env = require("../config/env");
const welcomeLogoPath = path.join(__dirname, "../../assets/scorecare-logo.PNG");

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

function buildScoreCareEmail(user, content) {
  const fullName = escapeHtml(user.fullName || "there");
  const title = escapeHtml(content.title);
  const heroTitle = escapeHtml(content.heroTitle);
  const heroSubtitle = escapeHtml(content.heroSubtitle);
  const scoreValue = escapeHtml(content.scoreValue || "800+");
  const scoreLabel = escapeHtml(content.scoreLabel || "Target");
  const sectionTitle = escapeHtml(content.sectionTitle);
  const primaryCtaLabel = escapeHtml(content.primaryCtaLabel || "Check my score now");
  const secondaryCtaLabel = escapeHtml(content.secondaryCtaLabel || "View my report");
  const featuresHtml = content.features.map((feature) => `
<!-- FEATURE -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f7fafc;border:1px solid #e2ecf0;border-collapse:collapse;margin-bottom:10px;">
<tr>
<td valign="top" style="padding:13px 14px 13px 10px;">
  <div style="font-size:13px;line-height:18px;font-weight:700;color:#1B3A5C;">${escapeHtml(feature.title)}</div>
  <div style="font-size:12px;line-height:19px;color:#64748b;margin-top:3px;">${escapeHtml(feature.description)}</div>
</td>
</tr>
</table>`).join("");

  return `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>${title}</title>

  <style>
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; }
      .mobile-pad { padding-left: 20px !important; padding-right: 20px !important; }
      .logo-section { padding-top: 14px !important; padding-bottom: 12px !important; }
      .logo-img { width: 112px !important; max-width: 112px !important; }
      .hero-title-col { width: 68% !important; }
      .hero-score-col { width: 32% !important; }

      .score-badge {
        width: 66px !important;
        height: 66px !important;
        min-width: 66px !important;
        max-width: 66px !important;
        min-height: 66px !important;
        max-height: 66px !important;
      }

      .score-num { font-size: 19px !important; line-height: 21px !important; }
      .score-label { font-size: 8px !important; }

      .score-range-card td {
        padding: 7px 2px !important;
        font-size: 9px !important;
        line-height: 12px !important;
      }

      .score-range-card span { font-size: 8px !important; }
      .button-table { width: 100% !important; }
      .button-cell { width: 50% !important; }

      .button-link {
        display: block !important;
        font-size: 12px !important;
        padding: 12px 8px !important;
        text-align: center !important;
      }
    }
  </style>
</head>

<body style="margin:0;padding:0;background-color:#eef2f7;font-family:Arial,Helvetica,sans-serif;color:#172033;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#eef2f7;margin:0;padding:0;border-collapse:collapse;">
<tr>
<td align="center" style="padding:18px 8px;">

<table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border:1px solid #dce4ef;border-collapse:separate;border-spacing:0;">

<!-- LOGO -->
<tr>
  <td align="center" class="mobile-pad logo-section" style="padding:18px 36px 14px;background-color:#ffffff;border-bottom:1px solid #e2ecf0;">
    <img class="logo-img" src="cid:scorecare-logo" width="130" alt="ScoreCare" style="display:block;width:130px;max-width:130px;height:auto;border:0;outline:none;text-decoration:none;margin:0 auto 8px;">
    <div style="font-size:10px;line-height:14px;color:#1B3A5C;letter-spacing:1.2px;text-transform:uppercase;font-weight:700;">
      Your Credit. Your Future.
    </div>
  </td>
</tr>

<!-- HERO -->
<tr>
  <td class="mobile-pad" style="padding:22px 36px;background-color:#eaf7f4;border-bottom:1px solid #c5e0d8;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
      <tr>
        <td class="hero-title-col" width="75%" valign="middle" style="width:75%;vertical-align:middle;">
          <div style="font-size:20px;line-height:26px;font-weight:700;color:#1B3A5C;">${heroTitle}</div>
          <div style="font-size:13px;line-height:20px;color:#1f9c80;margin-top:4px;">${heroSubtitle}</div>
        </td>

        <td class="hero-score-col" width="25%" align="right" valign="middle" style="width:25%;text-align:right;vertical-align:middle;">
          <div class="score-badge" style="display:inline-block;width:76px;height:76px;min-width:76px;max-width:76px;min-height:76px;max-height:76px;background-color:#ffffff;border:3px solid #2EC4A0;border-radius:999px;text-align:center;overflow:hidden;box-sizing:border-box;">
            <div style="height:16px;line-height:16px;font-size:1px;">&nbsp;</div>
            <div class="score-num" style="font-size:22px;line-height:24px;font-weight:700;color:#1B3A5C;text-align:center;">${scoreValue}</div>
            <div class="score-label" style="font-size:9px;line-height:12px;font-weight:700;color:#2EC4A0;text-transform:uppercase;letter-spacing:.5px;text-align:center;">${scoreLabel}</div>
          </div>
        </td>
      </tr>
    </table>
  </td>
</tr>

<!-- BODY -->
<tr>
<td class="mobile-pad" style="padding:28px 36px 8px;background-color:#ffffff;">

<p style="margin:0 0 12px;font-size:14px;line-height:24px;color:#4a5568;">
  Dear <strong style="color:#1B3A5C;">${fullName}</strong>,
</p>

<p style="margin:0 0 12px;font-size:14px;line-height:24px;color:#4a5568;">
  ${content.primaryContentHtml}
</p>

<p style="margin:0 0 22px;font-size:14px;line-height:24px;color:#4a5568;">
  ${content.secondaryContentHtml}
</p>

<!-- CREDIT SCORE RANGES -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f7fafc;border:1px solid #e2ecf0;border-collapse:separate;border-spacing:0;margin:0 0 24px;">
<tr>
  <td style="padding:16px 18px 10px;font-size:11px;line-height:16px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.8px;">
    Credit score ranges
  </td>
</tr>
<tr>
<td style="padding:0 18px 18px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;table-layout:fixed;">
<tr>
<td width="25%" style="padding:0 3px 0 0;">
  <table class="score-range-card" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F09595;border-collapse:collapse;">
    <tr><td align="center" style="padding:9px 2px;font-size:11px;line-height:15px;color:#501313;font-weight:700;">300-549<br><span style="font-size:10px;color:#791F1F;font-weight:400;">Poor</span></td></tr>
  </table>
</td>
<td width="25%" style="padding:0 3px;">
  <table class="score-range-card" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FAC775;border-collapse:collapse;">
    <tr><td align="center" style="padding:9px 2px;font-size:11px;line-height:15px;color:#412402;font-weight:700;">550-649<br><span style="font-size:10px;color:#633806;font-weight:400;">Fair</span></td></tr>
  </table>
</td>
<td width="25%" style="padding:0 3px;">
  <table class="score-range-card" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#a8dfc9;border-collapse:collapse;">
    <tr><td align="center" style="padding:9px 2px;font-size:11px;line-height:15px;color:#0a3d29;font-weight:700;">650-749<br><span style="font-size:10px;color:#155c3c;font-weight:400;">Good</span></td></tr>
  </table>
</td>
<td width="25%" style="padding:0 0 0 3px;">
  <table class="score-range-card" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#2EC4A0;border-collapse:collapse;">
    <tr><td align="center" style="padding:9px 2px;font-size:11px;line-height:15px;color:#ffffff;font-weight:700;">750-900<br><span style="font-size:10px;color:#e8fffa;font-weight:400;">Excellent</span></td></tr>
  </table>
</td>
</tr>
</table>
</td>
</tr>
</table>

<p style="margin:0 0 12px;font-size:13px;line-height:20px;font-weight:700;color:#1B3A5C;">
  ${sectionTitle}
</p>

${featuresHtml}

<!-- BUTTONS -->
<table role="presentation" class="button-table" align="center" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px auto 24px;border-collapse:collapse;">
<tr>
<td class="button-cell" width="50%" style="padding:0 5px 0 0;">
  <a class="button-link" href="https://www.scorecareapp.com/dashboard" style="display:block;background-color:#2EC4A0;color:#ffffff;font-size:14px;line-height:18px;font-weight:700;text-decoration:none;padding:13px 10px;text-align:center;border-radius:6px;">
    ${primaryCtaLabel}
  </a>
</td>
<td class="button-cell" width="50%" style="padding:0 0 0 5px;">
  <a class="button-link" href="https://www.scorecareapp.com/report" style="display:block;background-color:#ffffff;color:#1B3A5C;font-size:14px;line-height:18px;font-weight:700;text-decoration:none;padding:12px 10px;border:1px solid #1B3A5C;text-align:center;border-radius:6px;">
    ${secondaryCtaLabel}
  </a>
</td>
</tr>
</table>

<!-- SUPPORT -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e2ecf0;border-collapse:collapse;">
<tr>
<td style="padding:18px 0 0;">
  <p style="margin:0 0 10px;font-size:13px;line-height:22px;color:#64748b;">
    Have questions? Our credit experts are available <strong style="color:#1B3A5C;">Mon-Sat, 9 AM - 7 PM IST.</strong>
  </p>
  <p style="margin:0 0 16px;font-size:13px;line-height:22px;color:#64748b;">
    Email: <a href="mailto:support@scorecareapp.com" style="color:#2EC4A0;font-weight:700;text-decoration:none;">support@scorecareapp.com</a><br>
    Website: <a href="https://www.scorecareapp.com" style="color:#2EC4A0;font-weight:700;text-decoration:none;">www.scorecareapp.com</a>
  </p>
  <p style="margin:0 0 20px;font-size:13px;line-height:22px;color:#64748b;">
    Warm regards,<br>
    <strong style="color:#1B3A5C;">Team ScoreCare</strong><br>
    <span style="font-size:11px;color:#94a3b8;">Scoresathi Technologies Pvt. Ltd.</span>
  </p>
</td>
</tr>
</table>

</td>
</tr>

<!-- LEGAL -->
<tr>
<td class="mobile-pad" style="padding:14px 36px;background-color:#f7fafc;border-top:1px solid #e2ecf0;">
  <p style="margin:0 0 6px;font-size:11px;line-height:17px;font-weight:700;color:#64748b;">
    About ScoreCare
  </p>
  <p style="margin:0;font-size:11px;line-height:18px;color:#94a3b8;">
    Scoresathi Technologies Pvt. Ltd. is a registered fintech company based in Hyderabad, India. We are an authorised credit information service provider integrated with Experian &amp; CRIF High Mark.<br>
    CIN: U66190TS2025PTC208827 | GSTIN: 36ABSCS2621M1ZT<br>
    Registered Office: P.No.18/2, Sector III, HUDA Techno Enclave, Madhapur, Shaikpet, Hyderabad - 500081, Telangana, India.<br>
    Customer Grievance Officer: grievance@scorecareapp.com | Website: www.scorecareapp.com
  </p>
</td>
</tr>

<!-- FOOTER -->
<tr>
<td align="center" class="mobile-pad" style="padding:14px 36px;background-color:#ffffff;border-top:1px solid #e2ecf0;">
  <p style="margin:0 0 4px;font-size:11px;line-height:17px;color:#94a3b8;">
    Copyright 2026 Scoresathi Technologies Pvt. Ltd. All rights reserved.
  </p>
  <p style="margin:0;font-size:11px;line-height:17px;color:#94a3b8;">
    <a href="#" style="color:#94a3b8;text-decoration:none;">Privacy Policy</a>
    &nbsp;|&nbsp;
    <a href="#" style="color:#94a3b8;text-decoration:none;">Terms &amp; Conditions</a>
    &nbsp;|&nbsp;
    <a href="#" style="color:#94a3b8;text-decoration:none;">Grievance Redressal</a>
  </p>
</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>
  `
}

function buildWelcomeEmail(user) {
  return buildScoreCareEmail(user, {
    title: "Welcome to ScoreCare",
    heroTitle: "Welcome to ScoreCare!",
    heroSubtitle: "Your credit journey starts now",
    scoreValue: "800+",
    scoreLabel: "Target",
    primaryContentHtml: 'Thank you for registering with <strong style="color:#1B3A5C;">ScoreCare</strong>. Your account is now active and you have instant access to your credit score, detailed credit report, and personalised improvement plan - completely free.',
    secondaryContentHtml: 'We are an authorised credit information service provider integrated with <strong style="color:#1B3A5C;">Experian and CRIF High Mark</strong> - giving you accurate, real-time insights into your credit health in one place.',
    sectionTitle: "What you get with ScoreCare:",
    primaryCtaLabel: "Check my score now",
    secondaryCtaLabel: "View my report",
    features: [
      {
        title: "Monthly credit score refresh",
        description: "Updated score from CIBIL & Experian every 30 days, with instant change alerts sent to your email and phone."
      },
      {
        title: "Full credit report analysis",
        description: "Account-by-account breakdown of your credit history, active EMIs, closed accounts, and hard enquiries."
      },
      {
        title: "AI-powered improvement tips",
        description: "Personalised, step-by-step recommendations to help you reach 800+ and unlock better loan & credit card offers."
      },
      {
        title: "Fraud & identity alerts",
        description: "Instant notification if any new enquiry or account appears on your credit report without your knowledge."
      }
    ]
  });
}

function buildMonthlyScoreChangedEmail(user, report = {}) {
  return buildScoreCareEmail(user, {
    title: "Your ScoreCare monthly score update is ready",
    heroTitle: "Your monthly score update is ready",
    heroSubtitle: "Included with your ScoreCare subscription",
    scoreValue: report.creditScore || "New",
    scoreLabel: report.creditScore ? "Score" : "Update",
    primaryContentHtml: 'Your <strong style="color:#1B3A5C;">ScoreCare subscription</strong> includes monthly credit score tracking. Your latest monthly credit score update is now available in your dashboard.',
    secondaryContentHtml: 'Review your updated credit report, check what changed, and follow your personalised improvement plan to keep moving toward a stronger credit profile.',
    sectionTitle: "What to review this month:",
    primaryCtaLabel: "Check updated score",
    secondaryCtaLabel: "View full report",
    features: [
      {
        title: "Latest credit score update",
        description: "See your latest saved CIBIL score and compare it with your previous credit activity."
      },
      {
        title: "Credit report review",
        description: "Check open accounts, active EMIs, closed accounts, and recent hard enquiries in one place."
      },
      {
        title: "Personalised improvement plan",
        description: "Use your ScoreCare recommendations to understand what actions can improve your score over time."
      },
      {
        title: "Fraud and identity alerts",
        description: "Review new enquiries or accounts early so you can act quickly if anything looks unfamiliar."
      }
    ]
  });
}

async function sendScoreCareTemplateEmail(user, subject, text, html) {
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
    const recipients =
      env.nodeEnv === "production" || env.smtp.testRecipients.length === 0
        ? [user.email]
        : env.smtp.testRecipients;

    await transporter.sendMail({
      from: `"${env.smtp.fromName}" <${env.smtp.user}>`,
      to: recipients,
      subject,
      text,
      html,
      attachments: [
        {
          filename: "scorecare-logo.PNG",
          path: welcomeLogoPath,
          cid: "scorecare-logo"
        }
      ]
    });

    return {
      status: "sent",
      to: recipients
    };
  } catch (error) {
    return {
      status: "failed",
      reason: error.message
    };
  }
}

async function sendWelcomeEmail(user) {
  return sendScoreCareTemplateEmail(
    user,
    "Welcome to ScoreCare",
    [
      `Dear ${user.fullName || "there"},`,
      "",
      "Welcome to ScoreCare. Your account is now active.",
      "You can now access your credit score, detailed credit report, and personalised improvement plan.",
      "",
      "ScoreCare gives you monthly score refreshes, report analysis, improvement tips, and fraud alerts.",
      "",
      "Check your score: https://www.scorecareapp.com/dashboard",
      "View your report: https://www.scorecareapp.com/report",
      "",
      "Need help? Contact support@scorecareapp.com",
      "",
      "Warm regards,",
      "Team ScoreCare"
    ].join("\n"),
    buildWelcomeEmail(user)
  );
}

async function sendMonthlyScoreChangedEmail(user, report) {
  return sendScoreCareTemplateEmail(
    user,
    "Your ScoreCare monthly score update is ready",
    [
      `Dear ${user.fullName || "there"},`,
      "",
      "Your monthly ScoreCare credit score update is ready.",
      report?.creditScore ? `Latest score: ${report.creditScore}` : "Your latest score is available in your dashboard.",
      "",
      "Review your updated credit report, check what changed, and follow your personalised improvement plan.",
      "",
      "Check updated score: https://www.scorecareapp.com/dashboard",
      "View full report: https://www.scorecareapp.com/report",
      "",
      "Need help? Contact support@scorecareapp.com",
      "",
      "Warm regards,",
      "Team ScoreCare"
    ].join("\n"),
    buildMonthlyScoreChangedEmail(user, report)
  );
}

module.exports = {
  sendMonthlyScoreChangedEmail,
  sendWelcomeEmail
};
