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

function buildWelcomeEmail(user) {
  const fullName = escapeHtml(user.fullName || "there");

  return `
  <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to ScoreCare</title>
  <style>
    body {
      margin: 0; padding: 0;
      background-color: #eef2f7;
      font-family: 'Helvetica Neue', Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    a { text-decoration: none; }
    .wrapper { width: 100%; background-color: #eef2f7; padding: 32px 16px; box-sizing: border-box; }
    .container { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #dce4ef; }

    /* HEADER */
    .header { background-color: #1B3A5C; padding: 30px 40px 24px; text-align: center; }
    .logo-img { display: block; margin: 0 auto 10px; max-width: 180px; height: auto; }
    .header-tagline { font-size: 11px; color: #7ab8c8; margin: 0; letter-spacing: 1.4px; text-transform: uppercase; }

    /* HERO */
    .hero { background: linear-gradient(135deg, #e8f7f4 0%, #ddf0f8 100%); padding: 22px 40px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #c5e0d8; }
    .hero-title { font-size: 19px; font-weight: 700; color: #1B3A5C; margin: 0 0 5px; }
    .hero-subtitle { font-size: 13px; color: #1f9c80; margin: 0; }
    .score-badge { width: 68px; height: 68px; border-radius: 50%; background: #fff; border: 2.5px solid #2EC4A0; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; text-align: center; }
    .score-badge .score-num { font-size: 21px; font-weight: 700; color: #1B3A5C; line-height: 1; }
    .score-badge .score-label { font-size: 9px; color: #2EC4A0; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }

    /* BODY */
    .body { padding: 28px 40px; }
    .greeting { font-size: 14px; color: #4a5568; margin: 0 0 12px; line-height: 1.7; }
    .greeting strong { color: #1B3A5C; font-weight: 700; }
    .intro { font-size: 14px; color: #4a5568; line-height: 1.7; margin: 0 0 12px; }
    .bureaus { font-size: 14px; color: #4a5568; line-height: 1.7; margin: 0 0 24px; }
    .bureaus strong { color: #1B3A5C; font-weight: 700; }

    /* SCORE RANGES */
    .score-range-box { background: #f7fafc; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; border: 1px solid #e2ecf0; }
    .score-range-label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.9px; margin: 0 0 12px; }
    .score-ranges { display: flex; gap: 6px; }
    .range-pill { flex: 1; border-radius: 7px; padding: 9px 6px; text-align: center; }
    .range-pill .rp-num { font-size: 11px; font-weight: 700; margin: 0 0 2px; display: block; }
    .range-pill .rp-label { font-size: 10px; margin: 0; display: block; }
    .rp-poor { background: #F09595; } .rp-poor .rp-num { color: #501313; } .rp-poor .rp-label { color: #791F1F; }
    .rp-fair { background: #FAC775; } .rp-fair .rp-num { color: #412402; } .rp-fair .rp-label { color: #633806; }
    .rp-good { background: #a8dfc9; } .rp-good .rp-num { color: #0a3d29; } .rp-good .rp-label { color: #155c3c; }
    .rp-excel { background: #2EC4A0; } .rp-excel .rp-num { color: #fff; } .rp-excel .rp-label { color: #d0fff5; }

    /* FEATURES */
    .features-title { font-size: 13px; font-weight: 700; color: #1B3A5C; margin: 0 0 12px; }
    .feature-row { display: flex; align-items: flex-start; gap: 14px; padding: 13px 14px; background: #f7fafc; border-radius: 9px; border: 1px solid #e2ecf0; margin-bottom: 10px; }
    .feature-icon { width: 36px; height: 36px; background: #e0f5ef; border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .feature-icon svg { display: block; }
    .feature-name { font-size: 13px; font-weight: 700; color: #1B3A5C; margin: 0 0 3px; }
    .feature-desc { font-size: 12px; color: #64748b; margin: 0; line-height: 1.55; }

    /* REFERRAL */
    .referral-box { background: #1B3A5C; border-radius: 12px; padding: 22px 26px; margin: 26px 0; text-align: center; border: 2px solid #2EC4A0; }
    .ref-title { font-size: 15px; font-weight: 700; color: #fff; margin: 0 0 6px; }
    .ref-desc { font-size: 12px; color: #9fcfdb; margin: 0 0 16px; line-height: 1.55; }
    .ref-code-box { display: inline-block; background: rgba(46,196,160,0.15); border: 1.5px dashed #2EC4A0; border-radius: 9px; padding: 9px 28px; margin-bottom: 14px; }
    .ref-code-label { font-size: 10px; color: #2EC4A0; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 2px; }
    .ref-code-val { font-size: 19px; font-weight: 700; color: #fff; letter-spacing: 2.5px; margin: 0; }
    .ref-share { display: inline-block; background: #2EC4A0; color: #fff; font-size: 13px; font-weight: 700; padding: 11px 30px; border-radius: 8px; }
    .ref-note { font-size: 11px; color: #7ab8c8; margin: 10px 0 0; }

    /* BUTTONS */
    .cta-row { text-align: center; margin: 24px 0; }
    .btn-primary { display: inline-block; background: #2EC4A0; color: #ffffff; font-size: 14px; font-weight: 700; padding: 13px 32px; border-radius: 8px; margin-right: 10px; }
    .btn-secondary { display: inline-block; background: transparent; color: #1B3A5C; font-size: 14px; font-weight: 700; padding: 12px 24px; border-radius: 8px; border: 1.5px solid #1B3A5C; }

    /* SUPPORT */
    .support-row { border-top: 1px solid #e2ecf0; padding-top: 18px; margin-top: 8px; }
    .support-row p { font-size: 13px; color: #64748b; line-height: 1.7; margin: 0 0 10px; }
    .support-row strong { color: #1B3A5C; }
    .contact-list { display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 16px; }
    .contact-item { font-size: 13px; color: #64748b; }
    .contact-item a { color: #2EC4A0; font-weight: 600; }
    .sign-off { font-size: 13px; color: #64748b; margin: 16px 0 0; line-height: 1.7; }
    .sign-off strong { color: #1B3A5C; font-weight: 700; }
    .sign-off small { font-size: 11px; color: #94a3b8; display: block; }

    /* LEGAL */
    .legal-strip { background: #f7fafc; border-top: 1px solid #e2ecf0; padding: 14px 40px; }
    .legal-title { font-size: 11px; font-weight: 700; color: #64748b; margin: 0 0 6px; }
    .legal-strip p { font-size: 11px; color: #94a3b8; line-height: 1.65; margin: 0; }

    /* FOOTER */
    .footer { border-top: 1px solid #e2ecf0; padding: 14px 40px; text-align: center; background: #fff; }
    .footer p { font-size: 11px; color: #94a3b8; margin: 0 0 4px; }
    .footer a { color: #94a3b8; }

    @media (max-width: 500px) {
      .body, .header, .legal-strip, .footer { padding-left: 20px; padding-right: 20px; }
      .hero { flex-direction: column; gap: 14px; padding: 16px 20px; }
      .btn-primary { margin-right: 0; margin-bottom: 10px; display: block; }
      .btn-secondary { display: block; }
      .score-ranges { flex-wrap: wrap; }
      .range-pill { min-width: calc(50% - 3px); }
      .contact-list { flex-direction: column; gap: 8px; }
    }
  </style>
</head>
<body>
<div class="wrapper">
  <div class="container">

    <!-- HEADER -->
    <div class="header">
      <img class="logo-img" src="cid:scorecare-logo" alt="ScoreCare" width="180" />
      <p class="header-tagline">Your Credit. Your Future.</p>
    </div>

    <!-- HERO -->
    <div class="hero">
      <div>
        <p class="hero-title">Welcome to ScoreCare!</p>
        <p class="hero-subtitle">Your credit journey starts now</p>
      </div>
      <div class="score-badge">
        <span class="score-num">800+</span>
        <span class="score-label">Target</span>
      </div>
    </div>

    <!-- BODY -->
    <div class="body">

      <p class="greeting">Dear <strong>${fullName}</strong>,</p>

      <p class="intro">
        Thank you for registering with <strong>ScoreCare</strong>. Your account is now active and you have instant access to your credit score, detailed credit report, and personalised improvement plan — completely free.
      </p>

      <p class="bureaus">
        We are an authorised credit information service provider integrated with <strong>Experian and CRIF High Mark</strong> — giving you accurate, real-time insights into your credit health in one place.
      </p>

      <!-- Score ranges -->
      <div class="score-range-box">
        <p class="score-range-label">Credit score ranges</p>
        <div class="score-ranges">
          <div class="range-pill rp-poor"><span class="rp-num">300–549</span><span class="rp-label">Poor</span></div>
          <div class="range-pill rp-fair"><span class="rp-num">550–649</span><span class="rp-label">Fair</span></div>
          <div class="range-pill rp-good"><span class="rp-num">650–749</span><span class="rp-label">Good</span></div>
          <div class="range-pill rp-excel"><span class="rp-num">750–900</span><span class="rp-label">Excellent</span></div>
        </div>
      </div>

      <!-- Features -->
      <p class="features-title">What you get with ScoreCare:</p>

      <div class="feature-row">
        <div class="feature-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2EC4A0" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        </div>
        <div>
          <p class="feature-name">Monthly credit score refresh</p>
          <p class="feature-desc">Updated score from CIBIL &amp; Experian every 30 days, with instant change alerts sent to your email and phone.</p>
        </div>
      </div>

      <div class="feature-row">
        <div class="feature-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2EC4A0" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        </div>
        <div>
          <p class="feature-name">Full credit report analysis</p>
          <p class="feature-desc">Account-by-account breakdown of your credit history, active EMIs, closed accounts, and hard enquiries.</p>
        </div>
      </div>

      <div class="feature-row">
        <div class="feature-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2EC4A0" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <div>
          <p class="feature-name">AI-powered improvement tips</p>
          <p class="feature-desc">Personalised, step-by-step recommendations to help you reach 800+ and unlock better loan &amp; credit card offers.</p>
        </div>
      </div>

      <div class="feature-row">
        <div class="feature-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2EC4A0" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div>
          <p class="feature-name">Fraud &amp; identity alerts</p>
          <p class="feature-desc">Instant notification if any new enquiry or account appears on your credit report without your knowledge.</p>
        </div>
      </div>



      <!-- CTAs -->
      <div class="cta-row">
        <a href="https://www.scorecareapp.com/dashboard" class="btn-primary">Check my score now</a>
        <a href="https://www.scorecareapp.com/report" class="btn-secondary">View my report</a>
      </div>

      <!-- Support -->
      <div class="support-row">
        <p>Have questions? Our credit experts are available <strong>Mon–Sat, 9 AM – 7 PM IST.</strong></p>
        <div class="contact-list">
          <span class="contact-item">✉ <a href="mailto:support@scorecareapp.com">support@scorecareapp.com</a></span>
          <span class="contact-item">🌐 <a href="https://www.scorecareapp.com">www.scorecareapp.com</a></span>
        </div>
      </div>

      <p class="sign-off">
        Warm regards,<br>
        <strong>Team ScoreCare</strong>
        <small>Scoresathi Technologies Pvt. Ltd.</small>
      </p>
    </div>

    <!-- LEGAL -->
    <div class="legal-strip">
      <p class="legal-title">About ScoreCare</p>
      <p>
        Scoresathi Technologies Pvt. Ltd. is a Registered fintech company based in Hyderabad, India.
        We are an authorised credit information service provider integrated with Experian &amp; CRIF High Mark.
        CIN: U66190TS2025PTC208827 &nbsp;|&nbsp; GSTIN: 36ABSCS2621M1ZT<br>
        Registered Office: P.No.18/2, Sector III, HUDA Techno Enclave, Madhapur, Shaikpet, Hyderabad – 500081, Telangana, India.<br>
        Customer Grievance Officer: grievance@scorecareapp.com &nbsp;|&nbsp; Website: www.scorecareapp.com
      </p>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <p>© 2026 Scoresathi Technologies Pvt. Ltd. All rights reserved.</p>
      <p>
        <a href="#">Unsubscribe</a> &nbsp;·&nbsp;
        <a href="#">Privacy Policy</a> &nbsp;·&nbsp;
        <a href="#">Terms &amp; Conditions</a> &nbsp;·&nbsp;
        <a href="#">Grievance Redressal</a>
      </p>
    </div>

  </div>
</div>
</body>
</html>

  `
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
      // to: user.email,
       to : ["sai.ca18@yahoo.com",
    "disendra123@gmail.com" ],
    
      subject: "Welcome to ScoreCare",
      text: `Hi ${user.fullName || "there"}, welcome to ScoreCare. Your profile has been completed successfully.`,
      html: body,
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
